const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const SHEET_ID = process.env.SHEET_ID;

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

let cachedDoc = null;

// Reuses one authenticated connection instead of reconnecting to Google on
// every single order/token request - this was the main backend bottleneck,
// and it gets worse as the Sheet accumulates more historical rows over time.
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

module.exports = { getDoc, getTodayDateString };
