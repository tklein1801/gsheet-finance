require('dotenv').config();

/**
 * @param {string[]} environmentVariables
 */
function checkForRequiredEnvironmentVariables(environmentVariables) {
  const MISSING_ENVIRONMENT_VARIABLES = environmentVariables.filter(
    (variable) => !process.env[variable]
  );
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
}

const APPLICATION = process.env.APPLICATION;
const PRODUCTION = process.env.PRODUCTION === 'true';
const SPREADSHEET = {
  id: process.env.SPREADSHEET_ID,
};

module.exports = {
  checkForRequiredEnvironmentVariables,
  APPLICATION,
  PRODUCTION,
  SPREADSHEET,
};
