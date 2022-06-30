require('dotenv').config();
const axios = require('axios');
const { addHours, previousDay } = require('date-fns');

class TransactionService {
  COOKIES = {
    XSRF: `XSRF-TOKEN=${process.env.XSRF}`,
    LARAVEL: `laravel_session=${process.env.LARAVEL}`,
  };

  OPTIONS = {
    // method: 'POST',
    headers: {
      cookie: `${this.COOKIES.XSRF} ${this.COOKIES.LARAVEL}`,
    },
  };

  constructor() {
    if (!process.env.LARAVEL) throw new Error("Environment-variable 'LARAVEL' not set");
    if (!process.env.XSRF) throw new Error("Environment-variable 'XSRF' not set");
  }

  /**
   * Get all transactions according to a specific bank-account
   * @param {string} iban
   * @param {{}[]} options
   * @returns {Promise<{id: string;source: string;amount: string;destination: string;initiator: string;info: string;type: "add" | "remove" | "transfer";created_at: string}[]>} transactions
   */
  getTransactions = (iban, options = this.OPTIONS) => {
    return new Promise((res, rej) => {
      axios
        .post(`https://info.realliferpg.de/banking/${iban}/data`, {}, options)
        .then((response) => res(response.data))
        .catch((err) => rej(err));
    });
  };

  /**
   * Get all incoming-transactions according to a specific bank-account from the past 24 hours
   * @param {string} iban
   * @param {{}[]} options
   * @returns {Promise<{id: string;source: string;amount: string;destination: string;initiator: string;info: string;type: "add" | "remove" | "transfer";created_at: string}[]>} transactions
   */
  getTodaysIncome = (iban, options = this.OPTIONS) => {
    return new Promise((res, rej) => {
      const now = addHours(new Date(), 2);
      axios
        .post(`https://info.realliferpg.de/banking/${iban}/data`, {}, options)
        .then((response) => {
          res(
            response.data.data
              .filter((transaction) => {
                let date = transaction.created_at.split('-')[0];
                date = `20${date.split('.')[2].substring(0, 2)}-${date.split('.')[1]}-${
                  date.split('.')[0]
                }`;

                // FIXME: Doesn't work and isn't requried
                // let time = transaction.created_at.split('-')[1];
                // time = .timesubstring(1, time.length) + ':00';
                return (
                  previousDay(now.getDate(), 1).getDate() === new Date(date).getDate() &&
                  transaction.destination === iban
                );
              })
              .map((transaction) => ({ ...transaction, amount: Number(transaction.amount) }))
          );
        })
        .catch((err) => rej(err));
    });
  };
}

module.exports = {
  TransactionService: TransactionService,
};
