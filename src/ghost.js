const EventEmitter = require('events').EventEmitter
const { decodeJWT, verifyJWT } = require('did-jwt')
const Room = require('ipfs-pubsub-room')

class GhostChat extends EventEmitter {

  // TODO: map did to peer id
  // TODO: for online list, what do we do about late joiners who don't know who's online yet
  // their might be some users we can't find since we joined late

  /**
   * Please use **space.joinChat** to get the instance of this class
   */
  constructor (name, { ipfs }, threeId, _onUpdate = console.log) {
    super()
    this._name = name
    this._spaceName = name.split('.')[2]
    this._3id = threeId
    this._room = Room(ipfs, name) // instance of ipfs pubsub room
    this._peerId = ipfs._peerInfo.id.toB58String()

    this._usersOnline = {}
    this._backlog = new Set() // set of past messages

    this._room.on('message', async ({ from, data }) => {
      // const { payload, issuer } = await this._verifyData(data)
      // TODO: solve jwt verification problem
      const { payload } = this.decode(data)
      if (payload) {
        switch (payload.type) {
          case 'join':
            this._userJoined(payload.iss, from)
          break;
          case 'request_backlog':
            this.sendDirect(from, { type: 'backlog', message: this.backlog })
          break;
          default:
            this._messageReceived(payload.iss, payload)
        }
      }
    })
    this._room.on('peer joined', (peer) => this.announce(peer))
    this._room.on('peer left', (peer) => this._userLeft(peer))
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
   * Get name of the chat
   *
   * @return    {String}      chat name
   */
  get peerId () {
    return this._peerId
  }

  /**
   * Get all users online
   *
   * @return    {Array<String>}      users online
   */
  get onlineUsers () {
    return Object.keys(this._usersOnline).filter(id => !id.startsWith('Qm'))
  }

  /**
   *
   *
   * @return    {String}      ipfs peer id
   */
  threeIdToPeerId (did) {
    return this._usersOnline[did]
  }

  /**
   * Get backlog of all past messages
   *
   * @return    {Array<Object>}      users online
   */
  get backlog () {
    return [...this._backlog]
  }

  // Announce entry in chat and share our 3id and peerID, empty jwt suffices
  async announce (to) {
    !to ? await this.broadcast({ type: 'join' })
    : await this.sendDirect(to, { type: 'join' })
  }

  /**
   * Post a message to the thread
   *
   * @param     {Object}    message                 The message
   * @param     {String}    to                      PeerID to send the message to (optional)
   * @return    {String}                            The postId of the new post
   */
  async post (message, to) {
    !to ? await this.broadcast({ type: 'chat', message })
    : await this.sendDirect(to, { type: 'chat', message })
  }

  /**
   * Request a backlog of past messages from peers in the chat
   *
   */
  async requestBacklog () {
    await this.broadcast({ type: 'request_backlog' })
  }

  /**
   * Leave the chat
   *
   */
  async leaveChat () {
    // await this.broadcast({ type: 'leave' })
    await this._room.leave()
  }

  /**
   * Broadcast a message to peers in the room
   *
   * @param     {Object}    message                 The message
   */
  async broadcast (message) {
    const jwt = await this._3id.signJWT(message, { use3ID: true })
    this._room.broadcast(jwt)
  }

  /**
   * Send a direct message to a peer
   *
   * @param     {String}    peerID              The PeerID of the receiver
   * @param     {Object}    message             The message
   */
  async sendDirect (to, message) {
    const jwt = await this._3id.signJWT(message, { use3ID: true })
    to.startsWith('Qm') ? this._room.sendTo(to, jwt)
    : this._room.sendTo(this.threeIdToPeerId(to), jwt)
  }

  _userJoined (did, peerID) {
    if (!this._usersOnline.hasOwnProperty(did) && this._3id.DID != did) {
      this.announce(peerID) // announce our presence to peer
      this._usersOnline[did] = peerID
      this._usersOnline[peerID] = did
      this.emit('user-joined', did, peerID)
    }
  }

  async _userLeft (peerID) {
    const did = this._usersOnline[peerID]
    delete this._usersOnline[did]
    delete this._usersOnline[peerID]
    this.emit('user-left', did, peerID)
  }

  _messageReceived (issuer, payload) {
    const { type, message, iss: from } = payload
    this._backlog.add({ type, from, message })
    this.emit('message', { type, from, message })
  }

  async _verifyData (data) {
    const jwt = data.toString()
    try {
      return await verifyJWT(jwt)
    } catch (e) {
      console.log(e)
    }
  }

  decode (data) {
    const jwt = data.toString()
    return decodeJWT(jwt)
  }

}

module.exports = GhostChat
