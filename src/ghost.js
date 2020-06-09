const EventEmitter = require('events').EventEmitter
const { verifyJWT } = require('did-jwt')
const { Resolver } = require('did-resolver')
const get3IdResolver = require('3id-resolver').getResolver
const getMuportResolver = require('muport-did-resolver').getResolver
const Room = require('ipfs-pubsub-room')
const utils = require('./utils')

const DEFAULT_BACKLOG_LIMIT = 100

class GhostThread extends EventEmitter {
  constructor (name, { ipfs }, opts = {}) {
    super()
    this._name = name
    this._spaceName = name.split('.')[2]
    this._room = new Room(ipfs, name) // instance of ipfs pubsub room
    this._ipfs = ipfs

    if (opts.ghostPinbot) {
      this._ghostPinbotPeerId = utils.getPeerIdFromMultiaddr(opts.ghostPinbot)
    }

    this._members = {}
    this._backlog = new Set() // set of past messages
    this._backlogLimit = opts.ghostBacklogLimit || DEFAULT_BACKLOG_LIMIT

    this._filters = opts.ghostFilters || []

    const threeIdResolver = get3IdResolver(ipfs, { pin: true })
    const muportResolver = getMuportResolver(ipfs)
    this._resolver = new Resolver({ ...threeIdResolver, ...muportResolver })

    this._room.on('message', async ({ from, data }) => {
      let payload, issuer
      if (data.toString().startsWith('{')) {
        // we got a non signed message (can only be backlog request, or response)
        payload = JSON.parse(data)
        if (payload.type !== 'request_backlog' && payload.type !== 'backlog_response') {
          // join and messages need signatures
          return
        }
      } else {
        const verified = await this._verifyData(data)
        payload = verified.payload
        issuer = verified.issuer
      }

      // we pass the payload, issuer and peerID (from) to each filter in our filters array and reduce the value to a single boolean
      // this boolean indicates whether the message passed the filters
      const passesFilters = this._filters.reduce((acc, filter) => acc && filter(payload, issuer, from), true)

      if (payload && passesFilters) {
        switch (payload.type) {
          case 'join':
            this._userJoined(issuer, from)
            break
          case 'request_backlog':
            this.getPosts(this._backlogLimit)
              .then(posts => this._sendDirect({ type: 'backlog_response', message: posts }, from, true))
            break
          case 'backlog_response':
            payload.message.map(msg => {
              this._backlog.add(JSON.stringify(msg))
            })
            this.emit('backlog-received', { type: 'backlog', author: issuer, message: payload.message, timestamp: payload.iat })
            break
          default:
            this._messageReceived(payload)
        }
      }
    })
    this._room.on('peer joined', async (peer) => {
      await this._announce(peer)
      await this._requestBacklog(peer)
    })
    this._room.on('peer left', (peer) => this._userLeft(peer))
  }

  get isGhost () {
    return true
  }

  _set3id (threeId) {
    this._3id = threeId
    // announce to other peers that we are online
    this.listMembers().then(members => {
      this._room.getPeers().map(id => {
        this._announce(id)
      })
    })
  }

  /**
   * Get a list of users online
   *
   * @return    {Array<String>}      users online
   */
  async listMembers () {
    let members = Object.keys(this._members).filter(id => !id.startsWith('Qm'))

    if (this._ghostPinbotPeerId) {
      // exclude Ghost Pinbot
      members = members.filter(id => id !== this._ghostPinbotPeerId)
    }
    return members
  }

  /**
   * Get a peerId's corresponding 3ID
   *
   * @param     {String}      did               The DID of the user
   * @return    {String}      ipfs peer id
   */
  _threeIdToPeerId (did) {
    return this._members[did]
  }

  /**
   * Get backlog of all past messages
   *
   * @return    {Array<Object>}      users online
   */
  async getPosts (num = 0) {
    const posts = [...this._backlog]
      .map(msg => JSON.parse(msg))
      .sort((p1, p2) => p1.timestamp - p2.timestamp)
      .slice(-num)

    return posts
  }

  /**
   * Announce entry in chat and share our 3id and peerID
   *
   * @param     {String}      to              The PeerID of a user (optional)
   */
  async _announce (to) {
    if (this._3id) {
      // we don't announce presence if we're not authed
      !to ? await this._broadcast({ type: 'join' })
        : await this._sendDirect({ type: 'join' }, to)
    }
  }

  /**
   * Post a message to the thread
   *
   * @param     {Object}    message                 The message
   * @param     {String}    to                      PeerID to send the message to (optional)
   */
  async post (message, to) {
    !to ? await this._broadcast({ type: 'chat', message })
      : await this._sendDirect({ type: 'chat', message }, to)
  }

  async deletePost (hash) {
    throw new Error('Not possible to delete post in Ghost Thread')
  }

  async addModerator (id) {
    throw new Error('Not possible to add moderator in Ghost Thread')
  }

  async listModerators () {
    throw new Error('Not possible to list moderators in Ghost Thread')
  }

  async addMember (id) {
    throw new Error('Not possible to add member in Ghost Thread')
  }

  /**
   * Request a backlog of past messages from peers in the chat
   *
   * @param     {String}      to              The PeerID of a user (optional)
   */
  async _requestBacklog (to) {
    !to ? await this._broadcast({ type: 'request_backlog' })
      : await this._sendDirect({ type: 'request_backlog' }, to, true)
  }

  /**
   * Leave the chat
   *
   */
  async close () {
    await this._room.leave()
  }

  /**
   * Broadcast a message to peers in the room
   *
   * @param     {Object}    message                 The message
   */
  async _broadcast (message, noSignature) {
    if (!this._3id ? !noSignature : false) throw new Error('Can not send message if not authenticated')
    const payload = noSignature ? JSON.stringify(message) : await this._3id.signJWT(message)
    this._room.broadcast(payload)
  }

  /**
   * Send a direct message to a peer
   *
   * @param     {Object}    message             The message
   * @param     {String}    to                  The PeerID or 3ID of the receiver
   */
  async _sendDirect (message, to, noSignature) {
    if (!this._3id ? !noSignature : false) throw new Error('Can not send message if not authenticated')
    const payload = noSignature ? JSON.stringify(message) : await this._3id.signJWT(message)
    to.startsWith('Qm') ? this._room.sendTo(to, payload)
      : this._room.sendTo(this._threeIdToPeerId(to), payload)
  }

  /**
   * Register a function to be called after new updates
   * have been received from the network or locally.
   *
   * @param     {Function}  updateFn               The function that will get called
   */
  onUpdate (updateFn) {
    this.removeAllListeners('message')
    this.removeAllListeners('backlog-received')
    this.on('message', updateFn)
    this.on('backlog-received', updateFn)
  }

  /**
   * Register a function to be called after new capabilities
   * have been received from the network or locally.
   *
   * @param     {Function}  updateFn               The function that will get called
   */
  onNewCapabilities (updateFn) {
    this.removeAllListeners('user-joined')
    this.removeAllListeners('user-left')
    this.on('user-joined', updateFn)
    this.on('user-left', updateFn)
  }

  /**
   * Handler function for users joining
   *
   * @param     {String}    did                The DID of the user
   * @param     {Object}    peerID             The peerID of the user
   */
  async _userJoined (did, peerID) {
    const members = await this.listMembers()
    if (!members.includes(did) && (!this._3id || this._3id.DID !== did)) {
      this._members[did] = peerID
      this._members[peerID] = did
      this.emit('user-joined', 'joined', did, peerID)
    }
  }

  /**
   * Handler function for users leaving
   *
   * @param     {String}    peerID              The peerID of the user
   */
  async _userLeft (peerID) {
    const did = this._members[peerID]
    delete this._members[did]
    delete this._members[peerID]
    this.emit('user-left', 'left', did, peerID)
  }

  /**
   * Handler function for received messages
   *
   * @param     {String}    issuer              The issuer of the message
   * @param     {Object}    payload             The payload of the message
   */
  async _messageReceived (payload) {
    const { type, message, iss: author, iat: timestamp, postId } = payload
    this._backlog.add(JSON.stringify({ type, author, message, timestamp, postId }))
    this.emit('message', { type, author, message, timestamp, postId })
  }

  /**
   * Verifies the data received
   *
   * @param     {Buffer}    data                A buffer of the jwt
   * @return    {JWT}                           A verified JWT with our payload and issuer
   */
  async _verifyData (data) {
    const jwt = data.toString()
    const cidPromise = this._ipfs.dag.put(jwt)
    try {
      const verified = await verifyJWT(jwt, { resolver: this._resolver })
      verified.payload.postId = (await cidPromise).toString()
      return verified
    } catch (e) {
      console.log(e)
    }
  }
}

module.exports = GhostThread
