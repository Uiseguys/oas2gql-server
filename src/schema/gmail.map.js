export default {
  ListMessagesResponse: {
    messages: {
      operationId: 'gmailUsersMessagesGet',
      resolveObject: (object) => ({ id: object.id })
    }
  }
}
