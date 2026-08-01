const conversations = {};
const messages = {};

const MAX_MESSAGES_PER_CHAT = 25;

function saveMessage(wa_id, messageData) {
  if (!messages[wa_id]) {
    messages[wa_id] = [];
  }

  messages[wa_id].push(messageData);

  if (messages[wa_id].length > MAX_MESSAGES_PER_CHAT) {
    messages[wa_id] = messages[wa_id].slice(-MAX_MESSAGES_PER_CHAT);
  }

  const preview = messageData.type === 'text' ? messageData.content : `[${messageData.type.toUpperCase()}]`;

  if (!conversations[wa_id]) {
    conversations[wa_id] = {
      wa_id: wa_id,
      token: messageData.token || 'Pending',
      lastMessage: preview,
      updatedAt: new Date().toISOString(),
      unreadCount: messageData.sender === 'user' ? 1 : 0
    };
  } else {
    conversations[wa_id].lastMessage = preview;
    conversations[wa_id].updatedAt = new Date().toISOString();
    if (messageData.token) conversations[wa_id].token = messageData.token;
    if (messageData.sender === 'user') {
      conversations[wa_id].unreadCount = (conversations[wa_id].unreadCount || 0) + 1;
    }
  }
}

function markRead(wa_id) {
  if (conversations[wa_id]) {
    conversations[wa_id].unreadCount = 0;
  }
}

function updateConversationMeta(wa_id, meta) {
  if (!conversations[wa_id]) {
    conversations[wa_id] = { wa_id, token: meta.token || 'Pending', updatedAt: new Date().toISOString(), unreadCount: 0 };
  }
  Object.assign(conversations[wa_id], meta);
}

// Finds a message by its WhatsApp message ID (wamid) across all chats and
// updates its delivery status - used when Meta sends a status webhook event.
function updateMessageStatusByWamid(wamid, status) {
  for (const wa_id in messages) {
    const msg = messages[wa_id].find(m => m.wamid === wamid);
    if (msg) {
      msg.status = status;
      return wa_id;
    }
  }
  return null;
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
  updateMessageStatusByWamid,
  markRead,
  getConversations,
  getMessages
};
