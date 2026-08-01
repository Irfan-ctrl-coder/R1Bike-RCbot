const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const SHEET_ID = process.env.SHEET_ID;

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

let cachedDoc = null;

async function getDoc() {
  if (!cachedDoc) {
    cachedDoc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
    await cachedDoc.loadInfo();
  }
  return cachedDoc;
}

function getTodayDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

async function logOrder(data) {
  try {
    const doc = await getDoc();
    const sheet = doc.sheetsByIndex[0];

    await sheet.addRow({
      Token: data.token,
      WA_Number: data.wa_id,
      Language: data.language,
      Service: data.service,
      Number: data.number,
      VehicleType: data.vehicleType || '',
      DOB: data.dob || '',
      Status: 'Waiting for you',
      Date: getTodayDateString(),
      Timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });

    console.log(`Order logged to sheet: ${data.token}`);
  } catch (err) {
    console.error('Error logging to sheet:', err.message);
  }
}

module.exports = { logOrder, getDoc, getTodayDateString };