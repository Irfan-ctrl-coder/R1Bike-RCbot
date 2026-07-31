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
    const { to, caption } = req.body;
    const file = req.file;
    if (!to || !file) return res.status(400).json({ error: 'Missing fields' });

    const isImage = file.mimetype.startsWith('image/');
    const isAudio = file.mimetype.startsWith('audio/');
    const mediaId = await uploadMedia(file.buffer, file.mimetype);

    let type = 'document';
    if (isImage) {
      await sendImageMessage(to, mediaId, caption);
      type = 'image';
    } else if (isAudio) {
      await sendAudioMessage(to, mediaId);
      type = 'audio';
    } else {
      await sendDocumentMessage(to, mediaId, file.originalname);
    }

    const base64Data = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
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
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;