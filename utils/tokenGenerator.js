const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const SHEET_ID = process.env.SHEET_ID;

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

function getTodayDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// Returns { token, peopleAhead }
async function generateToken() {
  try {
    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    const today = getTodayDateString();
    const todaysRows = rows.filter(row => row.get('Date') === today);

    const peopleAhead = todaysRows.length;
    const tokenNumber = peopleAhead + 1;
    const token = `JFT-${String(tokenNumber).padStart(4, '0')}`;

    return { token, peopleAhead };
  } catch (err) {
    console.error('Error generating token:', err.message);
    return { token: `JFT-0001`, peopleAhead: 0 };
  }
}

module.exports = { generateToken };