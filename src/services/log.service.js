require('dotenv').config();
const { Client, LogType } = require('@dulliag/logger.js');

const credentials = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
};

const client = new Client('PostgreSQL', credentials, {
  application: process.env.APPLICATION,
  saveLogs: process.env.PRODUCTION === 'true',
});

/**
 *
 * @param {LogType} type
 * @param {string} category
 * @param {string} message
 * @returns {Promise<unknown>}
 */
const createLog = (type, category, message) => {
  return client.log(type, category, message);
};

module.exports = {
  createLog: createLog,
};
