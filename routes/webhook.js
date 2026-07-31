const express = require('express');
const router = express.Router();
const { handleIncomingMessage } = require('../utils/stateMachine');

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

router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (message) {
      const wa_id = message.from;
      let messageText = null;
      let buttonReplyId = null;

      if (message.type === 'text') {
        messageText = message.text.body;
      } else if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
        buttonReplyId = message.interactive.button_reply.id;
      }

      console.log(`Message from ${wa_id}: text="${messageText}" buttonReply="${buttonReplyId}"`);
      await handleIncomingMessage(wa_id, messageText, buttonReplyId);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Error handling webhook:', err.message);
    res.sendStatus(200);
  }
});

module.exports = router;