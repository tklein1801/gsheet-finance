const { google } = require('googleapis');
const { CronJob } = require('cron');
const { TransactionService } = require('./core/transaction.service');

const SPREADSHEET_NAME = process.env.SPREADSHEET_NAME;
/**
 * @param {number} index
 * @param {number} offset DEFAULT = 3
 * @returns {string}
 */
const ROW_RANGE = (index, offset = 3) =>
  `${SPREADSHEET_NAME}!A${offset + index}:O${offset + index}`;
const DATA_RANGE = `${SPREADSHEET_NAME}!A3:O1000`;
const PAYMENT_ACCOUNT = process.env.PAYMENT_ACCOUNT;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const task = new CronJob('0 3 * * *', async () => {
  const transactionService = new TransactionService();

  // const todaysTransactions = getTodaysTransactions(PAYMENT_ACCOUNT);
  const todaysTransactions = await transactionService.getTodaysIncome(PAYMENT_ACCOUNT);

  // If we haven't received any payment we don't to update any data in our spreadsheet
  if (todaysTransactions.length === 0) return;

  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials.json',
    scopes: 'https://www.googleapis.com/auth/spreadsheets',
  });

  // Create client instance for auth
  const client = await auth.getClient();

  // Instance of Google Sheets API
  const googleSheets = google.sheets({ version: 'v4', auth: client });

  const openLoans = (await getFinanceData(googleSheets, auth, SPREADSHEET_ID, DATA_RANGE)).filter(
    (loan) => !loan.paid
  );

  console.log('Received ' + todaysTransactions.length + ' payment/s');
  const loansWhichReceivedPayment = openLoans
    .map((loan) => {
      const downPayments = todaysTransactions.filter(
        (transaction) => transaction.source === loan.bankAccount
      );
      if (downPayments.length >= 1) {
        return {
          range: loan.range,
          alreadyPaid:
            loan.alreadyPaid + downPayments.reduce((prev, next) => prev + next.amount, 0),
        };
      }
    })
    // Because we aren't type-secure using Google Sheets we're gonna remove all entries which are undefined
    .filter((loan) => loan);

  // Update loans in Google Spreadsheet
  if (loansWhichReceivedPayment) {
    loansWhichReceivedPayment.forEach((payment) => {
      googleSheets.spreadsheets.values.update({
        auth,
        spreadsheetId: SPREADSHEET_ID,
        range: payment.range.split('!')[0] + '!' + payment.range.split(':')[1],
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[payment.alreadyPaid]],
        },
      });
    });
  }
});

task.start();

/**
 * Parse Google Sheets Euro currency string to number
 * @param {string} currencyString
 * @returns {number} Parsed number
 */
function parseCurrencyString(currencyString) {
  return Number(currencyString.replace(/[€.]+/g, '').split(',')[0]);
}

/**
 *
 * @param {sheets_v4.Sheets} googleSheets
 * @param {GoogleAuth<JSONClient>} auth
 * @param {string} spreadsheetId
 * @param {string} range
 * @returns {Promise<{range: string;paid: boolean;date: any;employee: any;customer: any;bankAccount: any;startDate: any;endDate: any;fundingLevel: number;downpayment: number;interest: any;remainingPayment: number;profit: number; alreadyPaid: number}[]>}
 */
async function getFinanceData(googleSheets, auth, spreadsheetId, range) {
  return (
    await googleSheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range: range,
    })
  ).data.values
    .filter((data) => data.length >= 12 && data[2] !== '')
    .map((data, index) => {
      return {
        range: ROW_RANGE(index),
        paid: data[1] === 'TRUE',
        date: data[2],
        employee: data[3],
        customer: data[4],
        bankAccount: data[5],
        startDate: data[6],
        endDate: data[7],
        fundingLevel: parseCurrencyString(data[8]),
        downpayment: parseCurrencyString(data[9]),
        interest: data[11],
        remainingPayment: parseCurrencyString(data[12]),
        profit: parseCurrencyString(data[13]),
        alreadyPaid: parseCurrencyString(data[14]),
      };
    });
}
