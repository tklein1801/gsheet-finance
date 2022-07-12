const { checkForRequiredEnvironmentVariables, APPLICATION, PRODUCTION } = require('./environment');

checkForRequiredEnvironmentVariables([
  'PRODUCTION',
  'APPLICATION',
  'SPREADSHEET_ID',
  'SPREADSHEET_FINANCE',
  'SPREADSHEET_PAYCHECKS',
  'SPREADSHEET_SPENDINGS',
  'TRANSFER_TOKEN',
  'PAYMENT_ACCOUNT',
  'LARAVEL',
  'XSRF',
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_DATABASE',
]);

const { version } = require('../package.json');
const { createLog } = require('./services/log.service');
const { checkLoanRepayment } = require('./tasks/loan-repayment.task');
const { payWeeklyPaycheck } = require('./tasks/paycheck.task');

createLog('LOG', 'Starting', `Starting ${APPLICATION} v${version}`);

if (!PRODUCTION) checkLoanRepayment.fireOnTick();
checkLoanRepayment.start();

if (!PRODUCTION) payWeeklyPaycheck.fireOnTick();
payWeeklyPaycheck.start();
