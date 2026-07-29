const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const SHEET_ID = process.env.SHEET_ID;

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
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
      DOB: data.dob || '',
      Status: 'Waiting for you',
      Timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });

    console.log(`Order logged to sheet: ${data.token}`);
  } catch (err) {
    console.error('Error logging to sheet:', err.message);
  }
}

module.exports = { logOrder };