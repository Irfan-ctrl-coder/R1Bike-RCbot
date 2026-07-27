const { sendTextMessage, sendButtonMessage } = require('../services/whatsapp');
const { generateToken } = require('./tokenGenerator');

const userStates = {}; // wa_id -> { step, language, service, number, token }

async function handleIncomingMessage(wa_id, messageText, buttonReplyId) {
  // If this is a brand new user, start the flow
  if (!userStates[wa_id]) {
    userStates[wa_id] = { step: 'LANG_SELECT' };
    await sendButtonMessage(wa_id, 'Welcome! Please select your language:', [
      { id: 'lang_kannada', title: 'Kannada' },
      { id: 'lang_english', title: 'English' }
    ]);
    return;
  }

  const state = userStates[wa_id];

  switch (state.step) {
    case 'LANG_SELECT':
      if (buttonReplyId === 'lang_kannada') {
        state.language = 'Kannada';
      } else if (buttonReplyId === 'lang_english') {
        state.language = 'English';
      } else {
        // User typed something instead of tapping a button
        await sendButtonMessage(wa_id, 'Please select a valid option:', [
          { id: 'lang_kannada', title: 'Kannada' },
          { id: 'lang_english', title: 'English' }
        ]);
        return;
      }
      state.step = 'SERVICE_SELECT';
      await sendButtonMessage(wa_id, 'Select service:', [
        { id: 'service_rc', title: 'RC Card' },
        { id: 'service_dl', title: 'Driving License' }
      ]);
      break;

    case 'SERVICE_SELECT':
      if (buttonReplyId === 'service_rc') {
        state.service = 'RC';
      } else if (buttonReplyId === 'service_dl') {
        state.service = 'DL';
      } else {
        await sendButtonMessage(wa_id, 'Please select a valid option:', [
          { id: 'service_rc', title: 'RC Card' },
          { id: 'service_dl', title: 'Driving License' }
        ]);
        return;
      }
      state.step = 'AWAITING_NUMBER';
      await sendTextMessage(wa_id, `Please enter your ${state.service === 'RC' ? 'Vehicle' : 'DL'} number:`);
      break;

    case 'AWAITING_NUMBER':
      if (!messageText || messageText.trim().length < 4) {
        await sendTextMessage(wa_id, 'Please enter a valid number.');
        return;
      }
      state.number = messageText.trim().toUpperCase();
      state.token = generateToken();
      state.step = 'DONE';

      // TODO: log to Google Sheet here

      await sendTextMessage(wa_id, `Your token is ${state.token}. Please wait, we'll confirm shortly.`);
      break;

    case 'DONE':
      await sendTextMessage(wa_id, `Your token ${state.token} is already in queue. We'll reach you shortly.`);
      break;
  }
}

module.exports = { handleIncomingMessage };