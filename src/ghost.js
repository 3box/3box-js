const EventEmitter = require('events')
const idUtils = require('./utils/id')
const Room = require('ipfs-pubsub-room')

class GhostChat extends EventEmitter {

  // TODO:
  // - constructor
  // - join logic x
  // - leave logic x
  // - message sending logic x
  // - jwt signing/decoding logic x
  // - listener logic x
  // - backlog logic x
  // - filter logic x

  /**
   * Please use **space.joinChat** to get the instance of this class
   */
  constructor (name, replicator, threeId) {
    this._name = name
    this._spaceName = name.split('.')[2]
    this._3id = threeId
    this._room = Room(replicator.ipfs, name) // TODO: find ipfs

    this._backlog = new Set() // set of past messages
    this._filter = (payload) => true

    this.broadcast({ type: 'join', threeId.signJWT() }) // Announce entry in chat and share our 3id and peerID
    // signing an empty jwt should suffice for this
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
    return Object.values(this._usersOnline)
  }

  /**
   * Get backlog of past messages
   *
   * @return    {Array<Object>}      users online
   */
  get backlog () {
    return this._backlog
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
    const jwt = this._3id.signJWT({ type: 'chat', ...message })
    this._room.sendTo(peerID, jwt)
  }

  /**
   * Request backlog of past messages
   *
   * @return     {Array<Object>}    backlog          Past messages
   */
  requestBacklog () {
    // TODO: write this
    this.broadcast({ type:'request_backlog' })
  }

  addFilter (filter) {
    this._filter = filter
  }

  /**
   * Checks if a payload passes our filter
   *
   * @return     {Array<Object>}    backlog          Past messages
   */
  valid (payload) {
    return this.filter(payload)
  }

  /**
   * Funnel message to appropriate handler
   *
   * @param     {Object}    message              The message
   */
  _funnelMessage (message) {
    // reads payload type and determines whether it's a join, leave or chat message
    // message {
    //   from: PeerID
    //   data: jwt
    // }
    const { from, data } = message
    const jwt = data.toString()
    let { payload, issuer, signer } = await idUtils.verifyJWT(jwt)
    if (issuer != signer.id) throw new Error('jwt is invalid')
    if (payload.iss != signer.id) throw new Error('jwt is invalid') // TODO: which one is it?
    if (!this.valid(payload)) payload = null // TODO: what to do with filters?
    switch (payload.type) {
      case 'join':
        this._userJoined(issuer, from)
      break
      case 'request_backlog':
        let response = this._3id.signJWT({ type: 'response', backlog: this.backlog })
        this._room.sendTo(from, response) // TODO: does it look good?
      break
      case 'reponse':
        this._backlog.add(payload.backlog) // TODO: does it look good?
      break
      case 'chat':
        this._messageReceived(payload)
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

  _messageReceived(message) {
    this._backlog.push(message)
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
