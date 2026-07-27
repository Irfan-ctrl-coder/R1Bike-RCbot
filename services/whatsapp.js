const axios = require('axios');

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const API_URL = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

// 1. Send a plain text message
async function sendTextMessage(to, text) {
  try {
    await axios.post(API_URL, {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: text }
    }, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
  } catch (err) {
    console.error('Error sending text message:', err.response?.data || err.message);
  }
}

// 2. Send interactive buttons (max 3 buttons allowed by WhatsApp)
async function sendButtonMessage(to, bodyText, buttons) {
  // buttons = [{ id: 'lang_kannada', title: 'Kannada' }, ...]
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
    }, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
  } catch (err) {
    console.error('Error sending button message:', err.response?.data || err.message);
  }
}

module.exports = { sendTextMessage, sendButtonMessage };