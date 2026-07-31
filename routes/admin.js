const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { sendTextMessage, uploadMedia, sendImageMessage, sendDocumentMessage, sendAudioMessage, convertToOggOpus } = require('../services/whatsapp');
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
    const isAudio = file.mimetype.startsWith('audio/') || isLiveVoice === 'true';
    
    let type = 'document';

    if (isAudio) {
      let convertedBuffer = file.buffer;

      // Convert live browser WebM recordings to real WhatsApp Ogg/Opus
      try {
        convertedBuffer = await convertToOggOpus(file.buffer);
      } catch (convErr) {
        console.error('FFmpeg conversion failed, using raw buffer:', convErr.message);
      }

      // Upload converted buffer to Meta
      const mediaId = await uploadMedia(convertedBuffer, 'audio/ogg; codecs=opus');
      
      try {
        // Send as Native Voice Note (waveform + play button)
        await sendAudioMessage(to, mediaId);
        type = 'audio';
      } catch (audioErr) {
        console.warn('Native audio send failed, delivering fallback document:', audioErr.message);
        await sendDocumentMessage(to, mediaId, 'Voice_Note.opus');
      }

      const base64Data = `data:audio/ogg;base64,${convertedBuffer.toString('base64')}`;
      saveMessage(to, {
        id: 'admin_' + Date.now(),
        sender: 'admin',
        type: type,
        content: base64Data,
        caption: caption || '',
        filename: file.originalname,
        timestamp: new Date().toISOString()
      });

      return res.json({ success: true });
    } else if (isImage) {
      const mediaId = await uploadMedia(file.buffer, file.mimetype);
      await sendImageMessage(to, mediaId, caption || '');
      type = 'image';
    } else {
      const mediaId = await uploadMedia(file.buffer, file.mimetype);
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
    console.error('Send file error:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;