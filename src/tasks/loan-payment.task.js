const { PRODUCTION, SPREADSHEET } = require('../environment');
const { loans } = require('../../config.json');
const { google } = require('googleapis');
const { CronJob } = require('cron');
const { TransactionService } = require('../services/transaction.service');
const { createLog } = require('../services/log.service');
const { getFinanceData } = require('../services/spreadsheet.service');

const checkLoanPayments = new CronJob(loans.execution, async () => {
  createLog('LOG', 'Loan Payment', `Select todays income from our bank-account`);

  // Get todays payments using RLRPG Online Banking
  const transactionService = new TransactionService();
  const todaysIncome = await transactionService.getTodaysIncome(loans.bankAccount);
  createLog(
    'INFORMATION',
    'Loan Payment',
    JSON.stringify({
      message: `Received '${todaysIncome.length}' payments from our customers`,
      transactions: todaysIncome,
    })
  );

  // If we haven't received any payments we don't have any updates to do
  if (todaysIncome.length === 0) return;

  // Initialize Google Sheets Client
  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials.json',
    scopes: 'https://www.googleapis.com/auth/spreadsheets',
  });
  const client = await auth.getClient();
  const googleSheets = google.sheets({ version: 'v4', auth: client });

  // Get open loans from Google Sheets
  createLog('LOG', 'Loan Payment', `Select open loans`);
  const openLoans = (
    await getFinanceData(googleSheets, auth, SPREADSHEET.id, `${loans.spreadsheet.loans}!A3:O1000`)
  ).filter((loan) => !loan.paid);
  createLog(
    'INFORMATION',
    'Loan Payment',
    JSON.stringify({
      message: `Received '${openLoans.length}' open loans from our customers`,
      loans: openLoans,
    })
  );

  // Same reason, if we don't have any open loans we don't need to update their payments
  if (openLoans.length === 0) return;

  // Check if Sheet contains a open loan which received a payment
  const loansWhichReceivedPayment = openLoans.filter(
    (loan) =>
      todaysIncome.filter((transaction) => transaction.source === loan.bankAccount).length > 0
  );
  createLog(
    'INFORMATION',
    'Loan Payment',
    JSON.stringify({
      message: `Today '${loansWhichReceivedPayment.length}' loans have received a payment`,
      loans: loansWhichReceivedPayment,
    })
  );

  // Update Google Sheet
  try {
    const updatedLoans = loansWhichReceivedPayment.map((loan) => ({
      range: loan.range,
      alreadyPaid:
        loan.alreadyPaid +
        todaysIncome
          .filter((transaction) => transaction.source === loan.bankAccount)
          .reduce((prev, current) => prev + current.amount, 0),
    }));

    if (!PRODUCTION) return;
    updatedLoans.forEach((payment) => {
      googleSheets.spreadsheets.values
        .update({
          auth,
          spreadsheetId: SPREADSHEET.id,
          range: `${payment.range.split('!')[0]}!${payment.range.split(':')[1]}`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [[payment.alreadyPaid]],
          },
        })
        .then(() =>
          createLog(
            'LOG',
            'Loan Payment',
            JSON.stringify({
              message: `Updated loan '${payment.range}'`,
              loan: {
                range: payment.range,
                ...payment,
              },
            })
          )
        );
    });
  } catch (error) {
    createLog('ERROR', 'Loan Payment', error);
  } finally {
    createLog('INFORMATION', 'Loan Payment', 'Processing done');
  }
});

module.exports = { checkLoanPayments };
