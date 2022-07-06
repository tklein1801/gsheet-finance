require('dotenv').config();

const MISSING_ENVIRONMENT_VARIABLES = [
  'PRODUCTION',
  'APPLICATION',
  'SPREADSHEET_NAME',
  'SPREADSHEET_ID',
  'PAYMENT_ACCOUNT',
  'LARAVEL',
  'XSRF',
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_DATABASE',
].filter((variable) => !process.env[variable]);
if (MISSING_ENVIRONMENT_VARIABLES.length >= 1) {
  console.log(
    'ERROR',
    'Starting',
    JSON.stringify({
      missing: MISSING_ENVIRONMENT_VARIABLES,
      error: 'client/missing-environmentv-variables',
    })
  );
  process.exit(1);
}

const { google } = require('googleapis');
const { CronJob } = require('cron');
const { version } = require('../package.json');
const { TransactionService } = require('./core/transaction.service');
const { createLog } = require('./core/log.service');

const PRODUCTION = process.env.PRODUCTION === 'true';
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

createLog('LOG', 'Starting', `Starting ${process.env.APPLICATION} v${version}`);

const task = new CronJob('0 3 * * *', async () => {
  const transactionService = new TransactionService();

  createLog('LOG', 'Select data', `Select todays income from our bank-account`);
  const todaysTransactions = await transactionService.getTodaysIncome(PAYMENT_ACCOUNT);
  createLog(
    'INFORMATION',
    'Receive data',
    JSON.stringify({
      message: `Received '${todaysTransactions.length}' payments from our customers`,
      transactions: todaysTransactions,
    })
  );

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

  createLog('LOG', 'Select data', `Select open loans`);
  const openLoans = (await getFinanceData(googleSheets, auth, SPREADSHEET_ID, DATA_RANGE)).filter(
    (loan) => !loan.paid
  );
  createLog(
    'INFORMATION',
    'Receive data',
    JSON.stringify({
      message: `Received '${openLoans.length}' open loans from our customers`,
      loans: openLoans,
    })
  );

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
  createLog(
    'INFORMATION',
    'Process loans',
    JSON.stringify({
      message: `Today '${openLoans.length}' loans have received a payment`,
      loans: loansWhichReceivedPayment,
    })
  );

  // Update loans in Google Spreadsheet
  try {
    if (loansWhichReceivedPayment) {
      loansWhichReceivedPayment.forEach((payment) => {
        createLog(
          'LOG',
          'Updating loan',
          JSON.stringify({
            message: `Update loan '${payment.range}'`,
            loan: {
              range: payment.range.split('!')[0] + '!' + payment.range.split(':')[1],
              ...payment,
            },
          })
        );
        if (!PRODUCTION) return;
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
  } catch (error) {
    createLog('ERROR', 'Unknown', error);
  } finally {
    createLog('INFORMATION', 'Processing data', 'Processing done');
  }
});

if (!PRODUCTION) task.fireOnTick();
task.start();

/**
 * Parse Google Sheets Euro currency string to number
 * @param {string} currencyString
 * @returns {number} Parsed number
 */
function parseCurrencyString(currencyString) {
  if (!currencyString) console.log(currencyString);
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
