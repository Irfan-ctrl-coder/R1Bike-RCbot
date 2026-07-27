const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID;
const credentials = require(path.join(__dirname, '..', 'credentials', 'r1-bikes-3bc46d70fe96.json'));

const serviceAccountAuth = new JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function logOrder(data) {
  try {
    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    await sheet.addRow({
      Token: data.token,
      WA_Number: data.wa_id,
      Language: data.language,
      Service: data.service,
      Number: data.number,
      Status: 'Waiting for you',
      Timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });

    console.log(`Order logged to sheet: ${data.token}`);
  } catch (err) {
    console.error('Error logging to sheet:', err.message);
  }
}

module.exports = { logOrder };