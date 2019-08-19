const EventEmitter = require('events');
const Room = require('ipfs-pubsub-room')

class GhostChat extends EventEmitter {
  /**
   * Please use **space.joinChat** to get the instance of this class
   */
  constructor (name, threeId) {
    this._name = name
    this._spaceName = name.split('.')[2]
    this._3id = threeId
    this._room = Room(ipfs, name) // TODO: find ipfs

    this.broadcast({ type: 'join', threeId, peerID }) // Announce entry in chat and share our 3id and peerID
    this._room.on('message', this._funnelMessage) // funnels message to either onJoin, onLeave or onMessage
    this._room.on('peer left', this._userLeft)
  }

  /**
   * Get name of the chat
   *
   * @return    {String}      chat name
   */
  get name () {
    return this._name
  }

  /**
   * Get all users online
   *
   * @return    {Array<Object>}      users online
   */
  get onlineUsers () {
    return this._usersOnline
  }

  /**
   * Post a message to the thread
   *
   * @param     {Object}    message                 The message
   * @return    {String}                            The postId of the new post
   */
  post (message) {
    this.broadcast({
      type: 'chat',
      ...message
    })
  }


  /**
   * Leave the chat
   *
   */
  async leaveChat () {
    await this._room.leave()
  }

  /**
   * Broadcast a message to peers in the room
   *
   * @param     {Object}    message                 The message
   */
  broadcast (message) {
    this._room.broadcast(JSON.stringify(message))
  }

  /**
   * Send a direct message to a peer
   *
   * @param     {String}    did                 The DID of the receiver
   * @param     {Object}    message             The message
   */
  sendDirect (did, message) {
    // TODO: write this
  }

  /**
   * Request backlog of past messages
   *
   * @return     {Array<Object>}    backlog          Past messages
   */
  requestBacklog () {
    // TODO: write this
  }

  /**
   * Funnel message to appropriate handler
   *
   * @param     {Object}    message              The message
   */
  _funnelMessage (message) {
    // reads message type and determines whether it's a join, leave or chat message
    switch (message.type) {
      case 'join':
       this._userJoined(message.did, message.peerID)
      break
      case 'leave':
       this._userLeft(message.peerID)
      break
      case 'chat':
       this.emit('message', message)
      break
    }
  }

  _userJoined(did, peerID) {
    this._usersOnline[peerID] = { did, peerID }
    this.emit('user-joined', did, peerID)
  }

  _userLeft(peerID) {
    const did = this._usersOnline[peerID]
    delete this._usersOnline[peerID]
    this.emit('user-left', did, peerID)
  }

  /**
   * Register a function to be called after a user joins the chat
   *
   * @param     {Function}    callback              on-join callback
   */
  onJoin (callback) {
    this.on('user-joined', callback)
  }

  /**
   * Register a function to be called after a user leaves the chat
   *
   * @param     {Function}    callback              on-left callback
   */
  onLeave (callback) {
    this.on('user-left', callback)
  }

  /**
   * Register a function to be called after a user posts a message to the chat
   *
   * @param     {Function}    callback              on-message callback
   */
  onMessage (callback) {
    this.on('message', callback)
  }

}

module.exports = GhostChat
