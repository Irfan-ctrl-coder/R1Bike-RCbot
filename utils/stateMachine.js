const { sendTextMessage, sendButtonMessage } = require('../services/whatsapp');
const { generateToken } = require('./tokenGenerator');
const { logOrder } = require('../services/sheets');

const userStates = {}; // wa_id -> { step, language, service, number, token }

const messages = {
  Kannada: {
    selectService: 'ದಯವಿಟ್ಟು ಸೇವೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ:',
    serviceRC: 'ಆರ್‌ಸಿ ಕಾರ್ಡ್',
    serviceDL: 'ಡಿಎಲ್',
    enterNumber: (service) => `ದಯವಿಟ್ಟು ನಿಮ್ಮ ${service === 'RC' ? 'ವಾಹನ' : 'ಡಿಎಲ್'} ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ:`,
    invalidNumber: 'ದಯವಿಟ್ಟು ಮಾನ್ಯ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ.',
    tokenMessage: (token) => `ನಿಮ್ಮ ಟೋಕನ್ ${token}. ದಯವಿಟ್ಟು ಕಾಯಿರಿ, ನಾವು ಶೀಘ್ರದಲ್ಲೇ ಖಚಿತಪಡಿಸುತ್ತೇವೆ.`,
    invalidOption: 'ದಯವಿಟ್ಟು ಮಾನ್ಯ ಆಯ್ಕೆಯನ್ನು ಆರಿಸಿ:'
  },
  English: {
    selectService: 'Select service:',
    serviceRC: 'RC Card',
    serviceDL: 'Driving License',
    enterNumber: (service) => `Please enter your ${service === 'RC' ? 'Vehicle' : 'DL'} number:`,
    invalidNumber: 'Please enter a valid number.',
    tokenMessage: (token) => `Your token is ${token}. Please wait, we'll confirm shortly.`,
    invalidOption: 'Please select a valid option:'
  }
};

async function handleIncomingMessage(wa_id, messageText, buttonReplyId) {
  // Brand new user — start the flow
  if (!userStates[wa_id]) {
    userStates[wa_id] = { step: 'LANG_SELECT' };
    await sendButtonMessage(wa_id, 'Welcome! Please select your language / ದಯವಿಟ್ಟು ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ:', [
      { id: 'lang_kannada', title: 'ಕನ್ನಡ' },
      { id: 'lang_english', title: 'English' }
    ]);
    return;
  }

  const state = userStates[wa_id];

  switch (state.step) {
    case 'LANG_SELECT': {
      if (buttonReplyId === 'lang_kannada') {
        state.language = 'Kannada';
      } else if (buttonReplyId === 'lang_english') {
        state.language = 'English';
      } else {
        await sendButtonMessage(wa_id, 'Please select a valid option / ದಯವಿಟ್ಟು ಆಯ್ಕೆಮಾಡಿ:', [
          { id: 'lang_kannada', title: 'ಕನ್ನಡ' },
          { id: 'lang_english', title: 'English' }
        ]);
        return;
      }
      state.step = 'SERVICE_SELECT';
      const t = messages[state.language];
      await sendButtonMessage(wa_id, t.selectService, [
        { id: 'service_rc', title: t.serviceRC },
        { id: 'service_dl', title: t.serviceDL }
      ]);
      break;
    }

    case 'SERVICE_SELECT': {
      const t = messages[state.language];
      if (buttonReplyId === 'service_rc') {
        state.service = 'RC';
      } else if (buttonReplyId === 'service_dl') {
        state.service = 'DL';
      } else {
        await sendButtonMessage(wa_id, t.invalidOption, [
          { id: 'service_rc', title: t.serviceRC },
          { id: 'service_dl', title: t.serviceDL }
        ]);
        return;
      }
      state.step = 'AWAITING_NUMBER';
      await sendTextMessage(wa_id, t.enterNumber(state.service));
      break;
    }

    case 'AWAITING_NUMBER': {
      const t = messages[state.language];
      if (!messageText || messageText.trim().length < 4) {
        await sendTextMessage(wa_id, t.invalidNumber);
        return;
      }
      state.number = messageText.trim().toUpperCase();
      state.token = await generateToken();
      state.step = 'DONE';

      await logOrder({
        token: state.token,
        wa_id: wa_id,
        language: state.language,
        service: state.service,
        number: state.number
      });

      await sendTextMessage(wa_id, t.tokenMessage(state.token));
      break;
    }

    case 'DONE':
      // Bot goes fully silent — human takes over manually in WhatsApp
      console.log(`User ${wa_id} already has token ${state.token}. No auto-reply sent (manual takeover mode).`);
      break;
  }
}

module.exports = { handleIncomingMessage };