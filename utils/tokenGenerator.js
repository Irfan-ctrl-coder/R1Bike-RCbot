const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const SHEET_ID = process.env.SHEET_ID;

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

let counter = null; // will be set on first use by checking the sheet

async function initCounter() {
  if (counter !== null) return; // already initialized
  try {
    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    counter = rows.length + 1;
  } catch (err) {
    console.error('Error initializing token counter:', err.message);
    counter = 1; // fallback
  }
}

async function generateToken() {
  await initCounter();
  const token = `JFT-${String(counter).padStart(4, '0')}`;
  counter++;
  return token;
}

module.exports = { generateToken };