window.LOMO_CHAT = {
  listConversations: function (params) {
    return apiGetChatConversations(params || {});
  },
  startConversation: function (participantUserId) {
    return apiStartChatConversation(participantUserId);
  },
  listMessages: function (conversationId, params) {
    return apiGetChatMessages(conversationId, params || {});
  },
  sendMessage: function (conversationId, body) {
    return apiSendChatMessage(conversationId, body);
  },
};
