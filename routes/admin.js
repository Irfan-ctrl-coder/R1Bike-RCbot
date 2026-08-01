const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { sendTextMessage, uploadMedia, sendImageMessage, sendDocumentMessage, sendAudioMessage, convertToOggOpus, uploadToCloudinary } = require('../services/whatsapp');
const { saveMessage, getConversations, getMessages, markRead, deleteMessage, deleteConversation } = require('../utils/db');

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
  markRead(wa_id);
  res.json({ messages: getMessages(wa_id) });
});

router.post('/admin/send-text', checkAuth, async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'Missing fields' });

    const wamid = await sendTextMessage(to, message);

    const savedMsg = {
      id: 'admin_' + Date.now(),
      wamid: wamid,
      sender: 'admin',
      type: 'text',
      content: message,
      status: 'sent',
      timestamp: new Date().toISOString()
    };

    saveMessage(to, savedMsg);
    req.io.emit('new_message', { wa_id: to, message: savedMsg });

    res.json({ success: true, wamid });
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
    let wamid = null;

    if (isAudio) {
      let convertedBuffer = file.buffer;
      try {
        convertedBuffer = await convertToOggOpus(file.buffer);
      } catch (convErr) {
        console.error('FFmpeg conversion failed:', convErr.message);
      }

      const mediaId = await uploadMedia(convertedBuffer, 'audio/ogg; codecs=opus');

      const [sendResult, cloudResult] = await Promise.allSettled([
        sendAudioMessage(to, mediaId),
        uploadToCloudinary(convertedBuffer, 'video', 'ogg')
      ]);

      if (sendResult.status === 'fulfilled') {
        wamid = sendResult.value;
      } else {
        console.error('Native audio send failed, falling back to document:', sendResult.reason?.message);
        wamid = await sendDocumentMessage(to, mediaId, 'Voice_Note.opus');
      }

      type = 'audio';
      cloudUrl = cloudResult.status === 'fulfilled' ? cloudResult.value : '';

    } else if (isImage) {
      const mediaId = await uploadMedia(file.buffer, file.mimetype);

      const [sendResult, cloudResult] = await Promise.allSettled([
        sendImageMessage(to, mediaId, caption || ''),
        uploadToCloudinary(file.buffer, 'image')
      ]);

      wamid = sendResult.status === 'fulfilled' ? sendResult.value : null;
      type = 'image';
      cloudUrl = cloudResult.status === 'fulfilled' ? cloudResult.value : '';

    } else {
      const mediaId = await uploadMedia(file.buffer, file.mimetype);

      const [sendResult, cloudResult] = await Promise.allSettled([
        sendDocumentMessage(to, mediaId, file.originalname),
        uploadToCloudinary(file.buffer, 'raw')
      ]);

      wamid = sendResult.status === 'fulfilled' ? sendResult.value : null;
      cloudUrl = cloudResult.status === 'fulfilled' ? cloudResult.value : '';
    }

    const savedMsg = {
      id: 'admin_' + Date.now(),
      wamid: wamid,
      sender: 'admin',
      type: type,
      content: cloudUrl,
      caption: caption || '',
      filename: file.originalname,
      status: 'sent',
      timestamp: new Date().toISOString()
    };

    saveMessage(to, savedMsg);
    req.io.emit('new_message', { wa_id: to, message: savedMsg });

    res.json({ success: true, wamid });
  } catch (err) {
    console.error('Send file error:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE single message endpoint
router.delete('/admin/messages/:wa_id/:msg_id', checkAuth, (req, res) => {
  const { wa_id, msg_id } = req.params;
  const success = deleteMessage(wa_id, msg_id);
  if (success) {
    req.io.emit('message_deleted', { wa_id, msg_id });
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Message not found' });
  }
});

// DELETE full chat/conversation endpoint
router.delete('/admin/conversations/:wa_id', checkAuth, (req, res) => {
  const { wa_id } = req.params;
  const success = deleteConversation(wa_id);
  if (success) {
    req.io.emit('conversation_deleted', { wa_id });
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Conversation not found' });
  }
});

module.exports = router;