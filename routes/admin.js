const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { sendTextMessage, uploadMedia, sendImageMessage, sendDocumentMessage, sendAudioMessage, convertToOggOpus, uploadToCloudinary } = require('../services/whatsapp');
const { saveMessage, getConversations, getMessages } = require('../utils/db');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function checkAuth(req, res, next) {
  const password = req.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.get('/admin', (req, res) => {
  res.sendFile('admin.html', { root: './public' });
});

router.get('/admin/conversations', checkAuth, (req, res) => {
  res.json({ conversations: getConversations() });
});

router.get('/admin/messages/:wa_id', checkAuth, (req, res) => {
  const { wa_id } = req.params;
  res.json({ messages: getMessages(wa_id) });
});

router.post('/admin/send-text', checkAuth, async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'Missing fields' });
    
    await sendTextMessage(to, message);

    const savedMsg = {
      id: 'admin_' + Date.now(),
      sender: 'admin',
      type: 'text',
      content: message,
      timestamp: new Date().toISOString()
    };

    saveMessage(to, savedMsg);
    req.io.emit('new_message', { wa_id: to, message: savedMsg });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/send-file', checkAuth, upload.single('file'), async (req, res) => {
  try {
    const { to, caption, isLiveVoice } = req.body;
    const file = req.file;
    if (!to || !file) return res.status(400).json({ error: 'Missing fields' });

    const isImage = file.mimetype.startsWith('image/');
    const isAudio = file.mimetype.startsWith('audio/') || isLiveVoice === 'true';
    let type = 'document';
    let cloudUrl = '';

    if (isAudio) {
      let convertedBuffer = file.buffer;
      try {
        convertedBuffer = await convertToOggOpus(file.buffer);
      } catch (convErr) {
        console.error('FFmpeg conversion failed:', convErr.message);
      }

      const mediaId = await uploadMedia(convertedBuffer, 'audio/ogg; codecs=opus');
      try {
        await sendAudioMessage(to, mediaId);
        type = 'audio';
      } catch (audioErr) {
        await sendDocumentMessage(to, mediaId, 'Voice_Note.opus');
      }

      cloudUrl = await uploadToCloudinary(convertedBuffer, 'video');
    } else if (isImage) {
      const mediaId = await uploadMedia(file.buffer, file.mimetype);
      await sendImageMessage(to, mediaId, caption || '');
      type = 'image';
      cloudUrl = await uploadToCloudinary(file.buffer, 'image');
    } else {
      const mediaId = await uploadMedia(file.buffer, file.mimetype);
      await sendDocumentMessage(to, mediaId, file.originalname);
      cloudUrl = await uploadToCloudinary(file.buffer, 'raw');
    }

    const savedMsg = {
      id: 'admin_' + Date.now(),
      sender: 'admin',
      type: type,
      content: cloudUrl,
      caption: caption || '',
      filename: file.originalname,
      timestamp: new Date().toISOString()
    };

    saveMessage(to, savedMsg);
    req.io.emit('new_message', { wa_id: to, message: savedMsg });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;