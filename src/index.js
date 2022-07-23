const { checkForRequiredEnvironmentVariables, APPLICATION, PRODUCTION } = require('./environment');

checkForRequiredEnvironmentVariables([
  'PRODUCTION',
  'APPLICATION',
  'SPREADSHEET_ID',
  'TRANSFER_TOKEN',
  'LARAVEL',
  'XSRF',
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_DATABASE',
]);

const { version } = require('../package.json');
const { paychecks, loans } = require('../config.json');
const { createLog } = require('./services/log.service');
const { checkLoanPayments } = require('./tasks/loan-payment.task');
const { payWeeklyPaycheck } = require('./tasks/paycheck.task');

createLog('LOG', 'Starting', `Starting ${APPLICATION} v${version}`);

if (loans.enabled) {
  if (!PRODUCTION) checkLoanPayments.fireOnTick();
  checkLoanPayments.start();
}

if (paychecks.enabled) {
  if (!PRODUCTION) payWeeklyPaycheck.fireOnTick();
  payWeeklyPaycheck.start();
}
