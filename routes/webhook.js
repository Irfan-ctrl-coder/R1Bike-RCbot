const express = require('express');
const router = express.Router();
const { handleIncomingMessage } = require('../utils/stateMachine');
const { saveMessage, updateMessageStatusByWamid } = require('../utils/db');
const { fetchMediaFromMeta, uploadToCloudinary } = require('../services/whatsapp');

router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

router.post('/webhook', (req, res) => {
  res.sendStatus(200);

  (async () => {
    try {
      const entry = req.body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];

      // Delivery/read status updates for messages WE sent
      if (value?.statuses) {
        value.statuses.forEach(status => {
          if (status.status === 'failed') {
            console.error('[DELIVERY FAILURE REASON]:', JSON.stringify(status.errors, null, 2));
          }
          const wa_id = updateMessageStatusByWamid(status.id, status.status);
          req.io.emit('status_update', {
            wamid: status.id,
            status: status.status, // 'sent' | 'delivered' | 'read' | 'failed'
            wa_id
          });
        });
      }

      if (message) {
        const wa_id = message.from;
        let messageText = null;
        let buttonReplyId = null;
        let savedMsg = null;

        if (message.type === 'text') {
          messageText = message.text.body;
          savedMsg = {
            id: message.id,
            sender: 'user',
            type: 'text',
            content: messageText,
            timestamp: new Date().toISOString()
          };
        } else if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
          buttonReplyId = message.interactive.button_reply.id;
          savedMsg = {
            id: message.id,
            sender: 'user',
            type: 'text',
            content: `Selected: ${message.interactive.button_reply.title}`,
            timestamp: new Date().toISOString()
          };
        } else if (message.type === 'image') {
          const media = await fetchMediaFromMeta(message.image.id);
          if (media?.buffer) {
            const imageUrl = await uploadToCloudinary(media.buffer, 'image');
            savedMsg = {
              id: message.id,
              sender: 'user',
              type: 'image',
              content: imageUrl,
              caption: message.image.caption || 'Photo',
              timestamp: new Date().toISOString()
            };
          }
        } else if (message.type === 'document') {
          const media = await fetchMediaFromMeta(message.document.id);
          if (media?.buffer) {
            const docUrl = await uploadToCloudinary(media.buffer, 'raw');
            savedMsg = {
              id: message.id,
              sender: 'user',
              type: 'document',
              content: docUrl,
              filename: message.document.filename || 'Document.pdf',
              timestamp: new Date().toISOString()
            };
          }
        } else if (message.type === 'audio' || message.type === 'voice') {
          const audioId = message.audio?.id || message.voice?.id;
          if (audioId) {
            const media = await fetchMediaFromMeta(audioId);
            if (media?.buffer) {
              const audioUrl = await uploadToCloudinary(media.buffer, 'video');
              savedMsg = {
                id: message.id,
                sender: 'user',
                type: 'audio',
                content: audioUrl,
                timestamp: new Date().toISOString()
              };
            }
          }
        }

        if (savedMsg) {
          saveMessage(wa_id, savedMsg);
          req.io.emit('new_message', { wa_id, message: savedMsg });
        }

        await handleIncomingMessage(wa_id, messageText, buttonReplyId);
      }
    } catch (err) {
      console.error('Webhook async processing error:', err.message);
    }
  })();
});

module.exports = router;
