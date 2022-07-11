const { PRODUCTION, SPREADSHEET, PAYMENT_ACCOUNT } = require('../environment');
const { google } = require('googleapis');
const { CronJob } = require('cron');
const { TransactionService } = require('../services/transaction.service');
const { createLog } = require('../services/log.service');
const { getFinanceData } = require('../services/spreadsheet.service');

/**
 * @returns {CronJob}
 */
const checkLoanRepayment = new CronJob('0 3 * * *', async () => {
  const transactionService = new TransactionService();

  createLog('LOG', 'Loan Repayment', `Select todays income from our bank-account`);
  const todaysTransactions = await transactionService.getTodaysIncome(PAYMENT_ACCOUNT);
  createLog(
    'INFORMATION',
    'Loan Repayment',
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

  createLog('LOG', 'Loan Repayment', `Select open loans`);
  const openLoans = (
    await getFinanceData(googleSheets, auth, SPREADSHEET.id, `${SPREADSHEET.finance}!A3:O1000`)
  ).filter((loan) => !loan.paid);
  createLog(
    'INFORMATION',
    'Loan Repayment',
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
    'Loan Repayment',
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
          'Loan Repayment',
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
          spreadsheetId: SPREADSHEET.id,
          range: payment.range.split('!')[0] + '!' + payment.range.split(':')[1],
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [[payment.alreadyPaid]],
          },
        });
      });
    }
  } catch (error) {
    createLog('ERROR', 'Loan Repayment', error);
  } finally {
    createLog('INFORMATION', 'Loan Repayment', 'Processing done');
  }
});

module.exports = {
  checkLoanRepayment,
};
