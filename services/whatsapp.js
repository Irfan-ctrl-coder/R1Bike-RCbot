const axios = require('axios');
const FormData = require('form-data');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { Readable, Writable } = require('stream');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

ffmpeg.setFfmpegPath(ffmpegPath);

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const API_URL = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
const MEDIA_URL = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/media`;

// Converts WebM recordings to true WhatsApp Ogg/Opus voice notes
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
      .audioChannels(1)
      .audioFrequency(16000)
      .format('ogg')
      .on('error', (err) => reject(err))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .pipe(outputStream);
  });
}

// Converts incoming WhatsApp OGG/Opus to clean MP3 WITH EXACT DURATION METADATA
function convertToMp3(inputBuffer) {
  return new Promise((resolve, reject) => {
    const tempId = uuidv4();
    const tempInput = path.join('/tmp', `${tempId}_in.ogg`);
    const tempOutput = path.join('/tmp', `${tempId}_out.mp3`);

    // Write buffer to temp file so ffmpeg can analyze full stream duration
    fs.writeFile(tempInput, inputBuffer, (err) => {
      if (err) return reject(err);

      ffmpeg(tempInput)
        .audioCodec('libmp3lame')
        .audioBitrate(128)
        .format('mp3')
        .on('error', (ffmpegErr) => {
          // Cleanup on failure
          if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
          if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
          reject(ffmpegErr);
        })
        .on('end', () => {
          // Read full converted MP3 file with proper headers
          fs.readFile(tempOutput, (readErr, convertedBuffer) => {
            // Cleanup temp files
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
            if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);

            if (readErr) return reject(readErr);
            resolve(convertedBuffer);
          });
        })
        .save(tempOutput);
    });
  });
}

async function sendTextMessage(to, text) {
  try {
    await axios.post(API_URL, {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: text }
    }, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
  } catch (err) {
    console.error('Error sending text message:', err.response?.data || err.message);
    throw err;
  }
}

async function sendButtonMessage(to, bodyText, buttons) {
  try {
    await axios.post(API_URL, {
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
    await axios.post(API_URL, payload, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
  } catch (err) {
    console.error('Error sending image:', err.response?.data || err.message);
    throw err;
  }
}

async function sendDocumentMessage(to, mediaId, filename) {
  try {
    await axios.post(API_URL, {
      messaging_product: 'whatsapp',
      to: to,
      type: 'document',
      document: { id: mediaId, filename: filename || 'document.pdf' }
    }, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
  } catch (err) {
    console.error('Error sending document:', err.response?.data || err.message);
    throw err;
  }
}

async function sendAudioMessage(to, mediaId) {
  try {
    await axios.post(API_URL, {
      messaging_product: 'whatsapp',
      to: to,
      type: 'audio',
      audio: { id: mediaId }
    }, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
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
  convertToOggOpus,
  convertToMp3,
  sendTextMessage,
  sendButtonMessage,
  uploadMedia,
  sendImageMessage,
  sendDocumentMessage,
  sendAudioMessage,
  fetchMediaFromMeta
};