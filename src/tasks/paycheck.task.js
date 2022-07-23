const { CronJob } = require('cron');
const config = require('../../config.json');
const paycheckCfg = config.paychecks;
const { SPREADSHEET, PRODUCTION, APPLICATION, PAYMENT_ACCOUNT } = require('../environment');
const { createLog } = require('../services/log.service');
const { google } = require('googleapis');
const { getPaycheckData, addSpending } = require('../services/spreadsheet.service');
const { format, subDays } = require('date-fns');
const { TransactionService } = require('../services/transaction.service');

/**
 * @returns {CronJob}
 */
const payWeeklyPaycheck = new CronJob(paycheckCfg.execution, async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials.json',
    scopes: 'https://www.googleapis.com/auth/spreadsheets',
  });

  // Create client instance for auth
  const client = await auth.getClient();

  // Instance of Google Sheets API
  const googleSheets = google.sheets({ version: 'v4', auth: client });

  // Abrufen der errechneten Löhne unserer Angestellten
  createLog(
    'LOG',
    'Paycheck payment',
    JSON.stringify({
      message: `Abrufen der Gehaltschecks für die Woche vom '${format(
        subDays(new Date(), 6),
        'dd.MM'
      )}' bis zum '${format(new Date(), 'dd.MM')}'`,
    })
  );
  const paychecks = await getPaycheckData(
    googleSheets,
    auth,
    SPREADSHEET.id,
    `${paycheckCfg.spreadsheet.paychecks}!F3:J19`
  );
  createLog(
    'LOG',
    'Paycheck payment',
    JSON.stringify({
      message: `'${paychecks.length}' ${
        paychecks.length > 1 ? 'Gehaltscheck' : 'Gehaltschecks'
      } gefunden`,
      paychecks: paychecks,
    })
  );

  paychecks.map((paycheck, index) => {
    setTimeout(() => {
      const info = `Gehalt ${paycheck.employee} (${paycheck.bankAccount}) - BKR Autohof`;
      if (!PRODUCTION) return;
      new TransactionService()
        .transfer(paycheckCfg.paymentAccount, {
          target: paycheck.bankAccount,
          amount: paycheck.paycheck,
          info: info,
        })
        .then((result) => {
          addSpending(
            googleSheets,
            auth,
            SPREADSHEET.id,
            `${paycheckCfg.spreadsheet.outgoings}!A4:F`,
            {
              employee: APPLICATION,
              receiver: paycheck.employee,
              category: 'Gehalt',
              info: info,
              amount: paycheck.paycheck,
            }
          );
          createLog(
            'LOG',
            'Paycheck payment',
            JSON.stringify({ message: result, paycheck: paycheck })
          );
        })
        .catch((error) => createLog('ERROR', 'Paycheck payment', error));
    }, index * 250);
  });
});

module.exports = { payWeeklyPaycheck };
