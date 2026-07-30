const { sendTextMessage, sendButtonMessage } = require('../services/whatsapp');
const { generateToken } = require('./tokenGenerator');
const { logOrder } = require('../services/sheets');

const userStates = {};

const messages = {
  Kannada: {
    selectService: 'ದಯವಿಟ್ಟು ಸೇವೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ:',
    serviceRC: 'ಆರ್‌ಸಿ ಕಾರ್ಡ್',
    serviceDL: 'ಡಿಎಲ್',
    enterNumber: (service) => `ದಯವಿಟ್ಟು ನಿಮ್ಮ ${service === 'RC' ? 'ವಾಹನ' : 'ಡಿಎಲ್'} ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ:`,
    invalidNumber: 'ದಯವಿಟ್ಟು ಮಾನ್ಯ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ.',
    selectVehicleType: 'ದಯವಿಟ್ಟು ವಾಹನ ಪ್ರಕಾರವನ್ನು ಆಯ್ಕೆಮಾಡಿ:',
    twoWheeler: 'ಎರಡು ಚಕ್ರ',
    threeWheeler: 'ಮೂರು ಚಕ್ರ',
    fourWheeler: 'ನಾಲ್ಕು ಚಕ್ರ',
    enterDob: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಜನ್ಮ ದಿನಾಂಕವನ್ನು ನಮೂದಿಸಿ (DD/MM/YYYY):',
    invalidDob: 'ದಯವಿಟ್ಟು ಮಾನ್ಯ ಜನ್ಮ ದಿನಾಂಕವನ್ನು ನಮೂದಿಸಿ (DD/MM/YYYY):',
    tokenMessage: (token, peopleAhead) =>
      `ನಿಮಗಿಂತ ಮೊದಲು ${peopleAhead} ಜನರು ಕಾಯುತ್ತಿದ್ದಾರೆ. ನಿಮ್ಮ ಸರದಿ ಬಂದ ನಂತರ ನಿಮಗೆ ಸೇವೆ ನೀಡಲಾಗುವುದು. ನಿಮ್ಮ ಟೋಕನ್ ಸಂಖ್ಯೆ ${token}. ದಯವಿಟ್ಟು ತಾಳ್ಮೆಯಿಂದ ಕಾಯಿರಿ.`,
    invalidOption: 'ದಯವಿಟ್ಟು ಮಾನ್ಯ ಆಯ್ಕೆಯನ್ನು ಆರಿಸಿ:'
  },
  English: {
    selectService: 'Select service:',
    serviceRC: 'RC Card',
    serviceDL: 'Driving License',
    enterNumber: (service) => `Please enter your ${service === 'RC' ? 'Vehicle' : 'DL'} number:`,
    invalidNumber: 'Please enter a valid number.',
    selectVehicleType: 'Please select vehicle type:',
    twoWheeler: 'Two Wheeler',
    threeWheeler: 'Three Wheeler',
    fourWheeler: 'Four Wheeler',
    enterDob: 'Please enter your Date of Birth (DD/MM/YYYY):',
    invalidDob: 'Please enter a valid Date of Birth (DD/MM/YYYY):',
    tokenMessage: (token, peopleAhead) =>
      `There are ${peopleAhead} people ahead of you in the queue. Once your turn comes, we'll provide your service. Your token number is ${token}. Please wait patiently, we'll reach out soon.`,
    invalidOption: 'Please select a valid option:'
  }
};

function isValidDob(text) {
  const regex = /^\d{2}\/\d{2}\/\d{4}$/;
  return regex.test(text.trim());
}

async function finalizeOrder(wa_id, state, t) {
  const { token, peopleAhead } = await generateToken();
  state.token = token;
  state.step = 'DONE';

  await logOrder({
    token: state.token,
    wa_id: wa_id,
    language: state.language,
    service: state.service,
    number: state.number,
    vehicleType: state.vehicleType || '',
    dob: state.dob || ''
  });

  await sendTextMessage(wa_id, t.tokenMessage(state.token, peopleAhead));
}

async function handleIncomingMessage(wa_id, messageText, buttonReplyId) {
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

      if (state.service === 'RC') {
        state.step = 'VEHICLE_TYPE_SELECT';
        await sendButtonMessage(wa_id, t.selectVehicleType, [
          { id: 'vehicle_two', title: t.twoWheeler },
          { id: 'vehicle_three', title: t.threeWheeler },
          { id: 'vehicle_four', title: t.fourWheeler }
        ]);
      } else {
        state.step = 'AWAITING_DOB';
        await sendTextMessage(wa_id, t.enterDob);
      }
      break;
    }

    case 'VEHICLE_TYPE_SELECT': {
      const t = messages[state.language];
      if (buttonReplyId === 'vehicle_two') {
        state.vehicleType = 'Two Wheeler';
      } else if (buttonReplyId === 'vehicle_three') {
        state.vehicleType = 'Three Wheeler';
      } else if (buttonReplyId === 'vehicle_four') {
        state.vehicleType = 'Four Wheeler';
      } else {
        await sendButtonMessage(wa_id, t.invalidOption, [
          { id: 'vehicle_two', title: t.twoWheeler },
          { id: 'vehicle_three', title: t.threeWheeler },
          { id: 'vehicle_four', title: t.fourWheeler }
        ]);
        return;
      }
      await finalizeOrder(wa_id, state, t);
      break;
    }

    case 'AWAITING_DOB': {
      const t = messages[state.language];
      if (!messageText || !isValidDob(messageText)) {
        await sendTextMessage(wa_id, t.invalidDob);
        return;
      }
      state.dob = messageText.trim();
      await finalizeOrder(wa_id, state, t);
      break;
    }

    case 'DONE':
      console.log(`User ${wa_id} already has token ${state.token}. No auto-reply sent (manual takeover mode).`);
      break;
  }
}

module.exports = { handleIncomingMessage };