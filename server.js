require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const webhookRoutes = require('./routes/webhook'); // ADD THIS

const app = express();
app.use(bodyParser.json());

app.use('/', webhookRoutes); // ADD THIS

app.get('/', (req, res) => {
  res.send('JustFath RC/DL Bot server is running ✅');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});