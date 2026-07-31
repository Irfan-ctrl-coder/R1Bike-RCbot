const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { sendTextMessage, uploadMedia, sendImageMessage, sendDocumentMessage, sendAudioMessage } = require('../services/whatsapp');
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

    saveMessage(to, {
      id: 'admin_' + Date.now(),
      sender: 'admin',
      type: 'text',
      content: message,
      timestamp: new Date().toISOString()
    });

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
    const isAudio = file.mimetype.startsWith('audio/') || file.originalname.endsWith('.opus') || file.originalname.endsWith('.ogg') || file.originalname.endsWith('.webm') || isLiveVoice === 'true';
    
    let type = 'document';

    if (isAudio) {
      // Upload raw recording buffer to Meta
      const mediaId = await uploadMedia(file.buffer, 'audio/ogg');
      
      try {
        // Try native audio send first
        await sendAudioMessage(to, mediaId);
      } catch (audioErr) {
        console.warn('Native audio send failed, falling back to document voice note:', audioErr.message);
        // Guaranteed fallback: send as document voice file so WhatsApp delivers it every time
        await sendDocumentMessage(to, mediaId, 'Voice_Note.opus');
      }
      type = 'audio';
    } else if (isImage) {
      const mediaId = await uploadMedia(file.buffer, file.mimetype);
      await sendImageMessage(to, mediaId, caption || '');
      type = 'image';
    } else {
      const mediaId = await uploadMedia(file.buffer, file.mimetype);
      await sendDocumentMessage(to, mediaId, file.originalname);
    }

    const base64Data = `data:audio/ogg;base64,${file.buffer.toString('base64')}`;
    saveMessage(to, {
      id: 'admin_' + Date.now(),
      sender: 'admin',
      type: type,
      content: base64Data,
      caption: caption || '',
      filename: file.originalname,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Send file error:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;