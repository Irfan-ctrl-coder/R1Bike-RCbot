require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const webhookRoutes = require('./routes/webhook');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

app.use('/', webhookRoutes);
app.use('/', adminRoutes);

app.get('/', (req, res) => {
  res.send('JustFath RC/DL Bot server is running ✅');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});