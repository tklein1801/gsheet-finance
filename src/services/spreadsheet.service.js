const { format } = require('date-fns');
const { sheets_v4 } = require('googleapis');
const { SPREADSHEET } = require('../environment');

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
      /**
       * @param {number} index
       * @param {number} offset DEFAULT = 3
       * @returns {string}
       */
      const ROW_RANGE = (index, offset = 3) =>
        `${SPREADSHEET.finance}!A${offset + index}:O${offset + index}`;

      return {
        range: ROW_RANGE(index), // FIXME: Wrong value
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

/**
 *
 * @param {sheets_v4.Sheets} googleSheets
 * @param {GoogleAuth<JSONClient>} auth
 * @param {string} spreadsheetId
 * @param {string} range
 * @returns {Promise<{range: string; employee: string; bankAccount: string; totalSales: number; past7DayProfit: number; paycheck: number }[]>}
 */
async function getPaycheckData(googleSheets, auth, spreadsheetId, range) {
  return (
    await googleSheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range: range,
    })
  ).data.values
    .filter((data) => data.length >= 5 && data[1] !== '' && parseCurrencyString(data[4]) > 0)
    .map((data, index) => {
      /**
       * @param {number} index
       * @param {number} offset DEFAULT = 3
       * @returns {string}
       */
      const ROW_RANGE = (index, offset = 3) =>
        `${SPREADSHEET.paychecks}!F${offset + index}:J${offset + index}`;
      return {
        range: ROW_RANGE(index), // FIXME: Wrong value
        employee: data[0],
        bankAccount: data[1],
        totalSales: parseCurrencyString(data[2]),
        past7DayProfit: parseCurrencyString(data[3]),
        paycheck: parseCurrencyString(data[4]),
      };
    });
}

/**
 *
 * @param {sheets_v4.Sheets} googleSheets
 * @param {GoogleAuth<JSONClient>} auth
 * @param {string} spreadsheetId
 * @param {string} range The A1 notation of a range to search for a logical table of data. Values will be appended after the last row of the table.
 * @param {{employee: string; receiver: string; category: string; info: string; amount: number}} data
 * @return {void}
 */
async function addSpending(googleSheets, auth, spreadsheetId, range, data) {
  return googleSheets.spreadsheets.values.append({
    auth,
    spreadsheetId: spreadsheetId,
    range: range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: [
        [
          format(new Date(), 'dd.MM.yyyy'),
          data.employee,
          data.receiver,
          data.category,
          data.info,
          data.amount,
        ],
      ],
    },
  });
}

module.exports = { getFinanceData, getPaycheckData, addSpending };
