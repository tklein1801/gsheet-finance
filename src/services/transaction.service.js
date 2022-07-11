require('dotenv').config();
const axios = require('axios');
const { addHours, isSameDay, isAfter } = require('date-fns');

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
    if (!process.env.TRANSFER_TOKEN)
      throw new Error("Environment-variable 'TRANSFER_TOKEN' not set");
    this.TOKEN = process.env.TRANSFER_TOKEN;
    if (!process.env.LARAVEL) throw new Error("Environment-variable 'LARAVEL' not set");
    if (!process.env.XSRF) throw new Error("Environment-variable 'XSRF' not set");
  }
  /**
   *
   * @param {string} iban
   * @param {{target: string; amount: number; info: string}} transaction
   * @param {string} transferToken
   * @param {{}} options
   * @returns {Promise<string>}
   */
  transfer(iban, transaction, token = this.TOKEN, options = this.OPTIONS) {
    return new Promise((res, rej) => {
      axios
        .post(
          `https://info.realliferpg.de/banking/${iban}`,
          {
            _token: token,
            type: 'init_transaction',
            amount: transaction.amount.toString(),
            iban: transaction.target,
            info: transaction.info,
          },
          options
        )
        .then((response) => {
          const RESULT = response.data;

          if (!RESULT.includes('Deine Überweisung wurde aufgegeben und durchgeführt!')) {
            if (RESULT.includes('Falsches IBAN-Format!')) throw new Error('Falsches IBAN-Format!');

            if (RESULT.includes('Zu wenig Geld auf dem Konto!'))
              throw new Error('Zu wenig Geld auf dem Konto!');

            if (RESULT.includes('Zielkonto existiert nicht'))
              throw new Error('Zielkonto existiert nicht!');

            // console.log(RESULT);
            throw new Error('Ein unbekannter Fehler ist aufgetreten!');
          }

          res('Das Geld wurde überwiesen');
        })
        .catch((err) => rej(err));
    });
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
      let now = addHours(new Date(), 2);
      now.setDate(now.getDate() - 1);
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
                return (
                  (isSameDay(new Date(date), now) || isAfter(new Date(date), now)) &&
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
