let counter = 1; // resets to 1 on server restart — we'll fix this once Google Sheets is connected

function generateToken() {
  const token = `JFT-${String(counter).padStart(4, '0')}`;
  counter++;
  return token;
}

module.exports = { generateToken };