const EventEmitter = require('events')
const idUtils = require('./utils/id')
const Room = require('ipfs-pubsub-room')

class GhostChat extends EventEmitter {

/**
   * Please use **space.joinChat** to get the instance of this class
   */
  constructor (name, replicator, threeId) {
    this._name = name
    this._spaceName = name.split('.')[2]
    this._3id = threeId
    this._room = Room(replicator.ipfs, name) // instance of ipfs pubsub room

    this._usersOnline = new Set() // set of users online in DID and PeerID pairs
    this._backlog = new Set() // set of past messages

    this.broadcast({}) // Announce entry in chat and share our 3id and peerID, empty jwt suffices
    this._room.on('message', this._funnelMessage) // funnels message to either onJoin or onMessage
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
   * @return    {Array<String>}      users online
   */
  get onlineUsers () {
    return [...this._usersOnline]
  }

  /**
   * Get backlog of all past messages
   *
   * @return    {Array<Object>}      users online
   */
  get backlog () {
    return [...this._backlog]
  }

  /**
   * Post a message to the thread
   *
   * @param     {Object}    message                 The message
   * @param     {String}    to                      PeerID to send the message to
   * @return    {String}                            The postId of the new post
   */
  post (message, to = null) {
    !to ? this.broadcast({ type: 'chat', ...message })
    : this.sendDirect(to, { type: 'chat', ...message })
  }

  /**
   * Request a backlog of past messages from peers in the chat
   *
   */
  requestBacklog () {
    this.broadcast({ type: 'request_backlog' })
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
    const jwt = this._3id.signJWT(message)
    this._room.broadcast(jwt)
  }

  /**
   * Send a direct message to a peer
   *
   * @param     {String}    peerID              The PeerID of the receiver
   * @param     {Object}    message             The message
   */
  sendDirect (peerID, message) {
    const jwt = this._3id.signJWT(message)
    this._room.sendTo(peerID, jwt)
  }

  /**
   * Funnel message to appropriate handler
   *
   * @param     {Object}    message              The message
   */
  _funnelMessage ({ from, data }) {
    // reads payload type and determines whether it's a join, leave or chat message
    const jwt = data.toString()
    const { payload, issuer, signer } = await idUtils.verifyJWT(jwt)

    !this._usersOnline.has([issuer, from]) ? this._userJoined(issuer, from) // not in users online? emit join event
    : payload.type.includes('backlog') ? this.sendDirect(from, this.backlog) // payload is a backlog request? send backlog
    : this._messageReceived(payload) // ...or receive payload as message
  }

  _userJoined(did, peerID) {
    this._usersOnline.add([did, peerID])
    this.emit('user-joined', { did, peerID })
  }

  _userLeft(peerID) {
    const [did, ...] = this.onlineUsers.find(user => user.includes(peerID))
    this._usersOnline.delete([did, peerID])
    this.emit('user-left', { did, peerID })
  }

  _messageReceived(message) {
    this._backlog.add(message)
    this.emit('message', message)
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
