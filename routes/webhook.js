const express = require('express');
const router = express.Router();

// 1. Webhook verification (Meta calls this once, when you set up the webhook URL)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('Webhook verified successfully ✅');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 2. Receiving actual messages (Meta calls this every time a user messages your bot)
router.post('/webhook', (req, res) => {
  const body = req.body;

  console.log('Incoming webhook:', JSON.stringify(body, null, 2));

  // We'll add message-handling logic here in the next step

  res.sendStatus(200); // always respond 200 quickly, or Meta will retry/flag errors
});

module.exports = router;