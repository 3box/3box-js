const isIPFS = require('is-ipfs')
const API = require('./api')
const config = require('./config')

const ORBITDB_OPTS = config.orbitdb_options
const MODERATOR = 'MODERATOR'
const MEMBER = 'MEMBER'

const isValid3ID = did => {
  const parts = did.split(':')
  if (!parts[0] === 'did' || !parts[1] === '3') return false
  return isIPFS.cid(parts[2])
}

class Thread {
  /**
   * Please use **space.joinThread** to get the instance of this class
   */
  constructor (orbitdb, name, threeId, members, firstModerator, subscribe, ensureConnected) {
    this._orbitdb = orbitdb
    this._name = name
    this._spaceName = name.split('.')[2]
    this._3id = threeId
    this._subscribe = subscribe
    this._ensureConnected = ensureConnected
    this._queuedNewPosts = []
    this._members = Boolean(members)
    this._firstModerator = firstModerator || this._3id.getSubDID(this._spaceName)
  }

  /**
   * Post a message to the thread
   *
   * @param     {Object}    message                 The message
   * @return    {String}                            The postId of the new post
   */
  async post (message) {
    this._requireLoad()
    this._subscribe(this._address, { firstModerator: this._firstModerator, members: this._members, name: this._name })
    this._ensureConnected(this._address, true)
    const timestamp = Math.floor(new Date().getTime() / 1000) // seconds
    return this._db.add({
      message,
      timestamp
    })
  }

  get address () {
    return this._db ? this._address : null
  }

  async _getThreadAddress () {
    await this._initConfigs()
    const address = (await this._orbitdb._determineAddress(this._name, 'feed', {
      accessController: this._accessController
    }, false)).toString()
    this._address = address
  }

  /**
   * Add a moderator to this thread, throws error is user can not add a moderator
   *
   * @param     {String}    id                      Moderator Id
   */
  async addModerator (id) {
    this._requireLoad()
    if (id.startsWith('0x')) {
      id = await API.getSpaceDID(id, this._spaceName)
    }
    if (!isValid3ID(id)) throw new Error('addModerator: must provide valid 3ID')
    return this._db.access.grant(MODERATOR, id)
  }

  /**
   * List moderators
   *
   * @return    {Array<String>}      Array of moderator DIDs
   */
  async listModerators () {
    this._requireLoad()
    return this._db.access.capabilities['moderators']
  }

  /**
   * Add a member to this thread, throws if user can not add member, throw is not member thread
   *
   * @param     {String}    id                      Member Id
   */
  async addMember (id) {
    this._requireLoad()
    this._throwIfNotMembers()
    if (id.startsWith('0x')) {
      id = await API.getSpaceDID(id, this._spaceName)
    }
    if (!isValid3ID(id)) throw new Error('addModerator: must provide valid 3ID')
    this._throwIfNotMembers()
    return this._db.access.grant(MEMBER, id)
  }

  /**
   * List members, throws if not member thread
   *
   * @return    {Array<String>}      Array of member DIDs
   */
  async listMembers () {
    this._throwIfNotMembers()
    this._requireLoad()
    return this._db.access.capabilities['members']
  }

  _throwIfNotMembers () {
    if (!this._members) throw new Error('Thread: Not a members only thread, function not available')
  }

  /**
   * Delete post
   *
   * @param     {String}    id                      Moderator Id
   */
  async deletePost (hash) {
    this._requireLoad()
    return this._db.remove(hash)
  }

  /**
   * Returns an array of posts, based on the options.
   * If hash not found when passing gt, gte, lt, or lte,
   * the iterator will return all items (respecting limit and reverse).
   *
   * @param     {Object}    opts                    Optional parameters
   * @param     {String}    opts.gt                 Greater than, takes an postId
   * @param     {String}    opts.gte                Greater than or equal to, takes an postId
   * @param     {String}    opts.lt                 Less than, takes an postId
   * @param     {String}    opts.lte                Less than or equal to, takes an postId
   * @param     {Integer}   opts.limit              Limiting the number of entries in result, defaults to -1 (no limit)
   * @param     {Boolean}   opts.reverse            If set to true will result in reversing the result
   *
   * @return    {Array<Object>}                           true if successful
   */
  async getPosts (opts = {}) {
    this._requireLoad()
    if (!opts.limit) opts.limit = -1
    return this._db.iterator(opts).collect().map(entry => {
      const post = entry.payload.value
      const metaData = { postId: entry.hash, author: entry.identity.id }
      return Object.assign(metaData, post)
    })
  }

  /**
   * Register a function to be called after new updates
   * have been received from the network or locally.
   *
   * @param     {Function}  updateFn               The function that will get called
   */
  async onUpdate (updateFn) {
    this._requireLoad()
    this._db.events.on('replicated', (address, hash, entry, prog, tot) => {
      updateFn()
    })
    this._db.events.on('write', (dbname, entry) => {
      updateFn()
    })
  }

  /**
   * Register a function to be called for every new
   * capability that is added to the thread access controller.
   * This inlcudes when a moderator or member is added.
   * The function takes one parameter, which is the capabilities obj, or
   * you can call listModerator / listMembers again instead.
   *
   * @param     {Function}  updateFn     The function that will get called
   */

  async onNewCapabilities (updateFn) {
    this._db.access.on('updated', event => {
      updateFn(this._db.access.capabilities)
    })
  }

  async _load (odbAddress) {
    await this._initConfigs()
    const identity = this._identity
    this._db = await this._orbitdb.feed(odbAddress || this._name, {
      ...ORBITDB_OPTS,
      identity,
      accessController: this._accessController
    })
    await this._db.load()
    this._address = this._db.address.toString()
    this._ensureConnected(this._address, true)
    return this._address
  }

  _requireLoad () {
    if (!this._db) throw new Error('_load must be called before interacting with the store')
  }

  async close () {
    this._requireLoad()
    await this._db.close()
  }

  async _initConfigs () {
    if (this._identity) return
    this._identity = await this._3id.getOdbId(this._spaceName)
    if (this._firstModerator.startsWith('0x')) {
      this._firstModerator = await API.getSpaceDID(this._firstModerator, this._spaceName)
    }
    this._accessController = {
      type: 'thread-access',
      threadName: this._name,
      members: this._members,
      firstModerator: this._firstModerator,
      identity: this._identity
    }
  }
}

module.exports = Thread
