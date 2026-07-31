const express = require('express');
const router = express.Router();
const { handleIncomingMessage } = require('../utils/stateMachine');
const { saveMessage } = require('../utils/db');
const { fetchMediaFromMeta } = require('../services/whatsapp');

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
        saveMessage(wa_id, {
          id: message.id,
          sender: 'user',
          type: 'text',
          content: messageText,
          timestamp: new Date().toISOString()
        });
      } else if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
        buttonReplyId = message.interactive.button_reply.id;
        saveMessage(wa_id, {
          id: message.id,
          sender: 'user',
          type: 'text',
          content: `Selected: ${message.interactive.button_reply.title}`,
          timestamp: new Date().toISOString()
        });
      } else if (message.type === 'image') {
        const media = await fetchMediaFromMeta(message.image.id);
        const base64Data = media ? `data:${media.mimeType};base64,${media.buffer.toString('base64')}` : null;
        saveMessage(wa_id, {
          id: message.id,
          sender: 'user',
          type: 'image',
          content: base64Data,
          caption: message.image.caption || 'Photo',
          timestamp: new Date().toISOString()
        });
      } else if (message.type === 'document') {
        const media = await fetchMediaFromMeta(message.document.id);
        const base64Data = media ? `data:${media.mimeType};base64,${media.buffer.toString('base64')}` : null;
        saveMessage(wa_id, {
          id: message.id,
          sender: 'user',
          type: 'document',
          content: base64Data,
          filename: message.document.filename || 'Document.pdf',
          timestamp: new Date().toISOString()
        });
      } else if (message.type === 'audio' || message.type === 'voice') {
        const audioId = message.audio?.id || message.voice?.id;
        if (audioId) {
          const media = await fetchMediaFromMeta(audioId);
          const base64Data = media ? `data:audio/ogg;base64,${media.buffer.toString('base64')}` : null;
          saveMessage(wa_id, {
            id: message.id,
            sender: 'user',
            type: 'audio',
            content: base64Data,
            timestamp: new Date().toISOString()
          });
        }
      }

      await handleIncomingMessage(wa_id, messageText, buttonReplyId);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Error handling webhook:', err.message);
    res.sendStatus(200);
  }
});

module.exports = router;