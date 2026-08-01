const { getDoc, getTodayDateString } = require('./googleSheetClient');

async function generateToken() {
  try {
    const doc = await getDoc();
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
