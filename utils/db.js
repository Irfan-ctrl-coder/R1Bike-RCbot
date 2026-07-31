const conversations = {};
const messages = {};

// Caps history to the latest 25 messages per user to keep RAM usage super low
const MAX_MESSAGES_PER_CHAT = 25;

function saveMessage(wa_id, messageData) {
  if (!messages[wa_id]) {
    messages[wa_id] = [];
  }

  messages[wa_id].push(messageData);

  // Trim oldest messages automatically if limit is exceeded
  if (messages[wa_id].length > MAX_MESSAGES_PER_CHAT) {
    messages[wa_id] = messages[wa_id].slice(-MAX_MESSAGES_PER_CHAT);
  }

  if (!conversations[wa_id]) {
    conversations[wa_id] = {
      wa_id: wa_id,
      token: messageData.token || 'Pending',
      lastMessage: messageData.type === 'text' ? messageData.content : `[${messageData.type.toUpperCase()}]`,
      updatedAt: new Date().toISOString()
    };
  } else {
    conversations[wa_id].lastMessage = messageData.type === 'text' ? messageData.content : `[${messageData.type.toUpperCase()}]`;
    conversations[wa_id].updatedAt = new Date().toISOString();
    if (messageData.token) conversations[wa_id].token = messageData.token;
  }
}

function updateConversationMeta(wa_id, meta) {
  if (!conversations[wa_id]) {
    conversations[wa_id] = { wa_id, token: meta.token || 'Pending', updatedAt: new Date().toISOString() };
  }
  Object.assign(conversations[wa_id], meta);
}

function getConversations() {
  return Object.values(conversations).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function getMessages(wa_id) {
  return messages[wa_id] || [];
}

module.exports = {
  saveMessage,
  updateConversationMeta,
  getConversations,
  getMessages
};