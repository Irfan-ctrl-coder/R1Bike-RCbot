const axios = require('axios');
const FormData = require('form-data');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { Readable, Writable } = require('stream');
const cloudinary = require('cloudinary').v2;

ffmpeg.setFfmpegPath(ffmpegPath);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const API_URL = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
const MEDIA_URL = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/media`;

function uploadToCloudinary(fileBuffer, resourceType = 'auto', format = null) {
  return new Promise((resolve, reject) => {
    const options = { resource_type: resourceType, folder: 'r1bikes_whatsapp' };
    if (format) options.format = format;

    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(fileBuffer);
  });
}

// Converts browser recordings to WhatsApp-required 16kHz mono Ogg/Opus.
// Bitrate was previously 32k with no voice-mode tuning, which produced
// thin/broken-sounding speech. 64k + "voip" application mode fixes this.
function convertToOggOpus(inputBuffer) {
  return new Promise((resolve, reject) => {
    const inputStream = new Readable();
    inputStream.push(inputBuffer);
    inputStream.push(null);

    const chunks = [];
    const outputStream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      }
    });

    ffmpeg(inputStream)
      .audioCodec('libopus')
      .audioChannels(1)           // Mono, required by WhatsApp
      .audioFrequency(16000)      // 16kHz, required by WhatsApp
      .format('ogg')
      .outputOptions([
        '-b:a', '64k',
        '-application', 'voip'
      ])
      .on('error', (err) => reject(err))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .pipe(outputStream);
  });
}

async function sendTextMessage(to, text) {
  try {
    const res = await axios.post(API_URL, {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: text }
    }, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
    return res.data.messages[0].id;
  } catch (err) {
    console.error('Error sending text message:', err.response?.data || err.message);
    throw err;
  }
}

async function sendButtonMessage(to, bodyText, buttons) {
  try {
    const res = await axios.post(API_URL, {
      messaging_product: 'whatsapp',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.map(btn => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title }
          }))
        }
      }
    }, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
    return res.data.messages[0].id;
  } catch (err) {
    console.error('Error sending button message:', err.response?.data || err.message);
    throw err;
  }
}

async function uploadMedia(fileBuffer, mimeType) {
  try {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('file', fileBuffer, { filename: 'voice.ogg', contentType: mimeType || 'audio/ogg' });

    const response = await axios.post(MEDIA_URL, form, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, ...form.getHeaders() }
    });
    return response.data.id;
  } catch (err) {
    console.error('Error uploading media:', err.response?.data || err.message);
    throw err;
  }
}

async function sendImageMessage(to, mediaId, caption) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'image',
      image: { id: mediaId }
    };
    if (caption && caption.trim()) {
      payload.image.caption = caption.trim();
    }
    const res = await axios.post(API_URL, payload, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
    return res.data.messages[0].id;
  } catch (err) {
    console.error('Error sending image:', err.response?.data || err.message);
    throw err;
  }
}

async function sendDocumentMessage(to, mediaId, filename) {
  try {
    const res = await axios.post(API_URL, {
      messaging_product: 'whatsapp',
      to: to,
      type: 'document',
      document: { id: mediaId, filename: filename || 'document.pdf' }
    }, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
    return res.data.messages[0].id;
  } catch (err) {
    console.error('Error sending document:', err.response?.data || err.message);
    throw err;
  }
}

async function sendAudioMessage(to, mediaId) {
  try {
    const res = await axios.post(API_URL, {
      messaging_product: 'whatsapp',
      to: to,
      type: 'audio',
      audio: { id: mediaId }
    }, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
    return res.data.messages[0].id;
  } catch (err) {
    console.error('Error sending audio message:', err.response?.data || err.message);
    throw err;
  }
}

async function fetchMediaFromMeta(mediaId) {
  try {
    const metaRes = await axios.get(`https://graph.facebook.com/v20.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });

    const downloadRes = await axios.get(metaRes.data.url, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      responseType: 'arraybuffer'
    });

    return {
      buffer: Buffer.from(downloadRes.data, 'binary'),
      mimeType: metaRes.data.mime_type
    };
  } catch (err) {
    console.error('Error downloading media from Meta:', err.response?.data || err.message);
    return null;
  }
}

module.exports = {
  uploadToCloudinary,
  convertToOggOpus,
  sendTextMessage,
  sendButtonMessage,
  uploadMedia,
  sendImageMessage,
  sendDocumentMessage,
  sendAudioMessage,
  fetchMediaFromMeta
};
