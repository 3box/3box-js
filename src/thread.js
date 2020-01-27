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
  constructor (name, replicator, members, firstModerator, confidential, threeId, subscribe) {
    this._name = name
    this._replicator = replicator
    this._spaceName = name.split('.')[2]
    this._subscribe = subscribe
    this._queuedNewPosts = []
    this._members = Boolean(members)
    this._firstModerator = firstModerator

    this._keyHashId = confidential.keyHashId
    this._confidential = Boolean(this._keyHashId)
    //  TODO sym can just be created here, if conf thread with no keyHash
    this._symKey = confidential.symKey
    this._3id = threeId
  }

  /**
   * Post a message to the thread
   *
   * @param     {Object}    message                 The message
   * @return    {String}                            The postId of the new post
   */
  async post (message) {
    this._requireLoad()
    this._requireAuth()
    this._subscribe(this._address, { firstModerator: this._firstModerator, members: this._members, name: this._name })
    this._replicator.ensureConnected(this._address, true)
    const timestamp = Math.floor(new Date().getTime() / 1000) // seconds

    // TODO if exteneded, could entryp first then call this func
    if (this._confidential) {
      message = await this._3id.symEncrypt(this._symKey, JSON.stringify(message))
    }

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
    const address = (await this._replicator._orbitdb._determineAddress(this._name, 'feed', {
      accessController: this._accessController
    }, false)).toString()
    this._address = address
    return this._address
  }

  /**
   * Add a moderator to this thread, throws error is user can not add a moderator
   *
   * @param     {String}    id                      Moderator Id
   */
  async addModerator (id, ciphertext) {
    // TODO dont pass ciphtext here, if access, user as sym key, and this func can enc
    // allthough adding self is different
    this._requireLoad()
    this._requireAuth()
    if (id.startsWith('0x')) {
      id = await API.getSpaceDID(id, this._spaceName)
    }
    // TODO if conf thread, also key pub key, and 3id encrypt to pubkey and did
    // TODO req or throw for ciphertext if confidentials thread
    if (!isValid3ID(id)) throw new Error('addModerator: must provide valid 3ID')
    return this._db.access.grant(MODERATOR, id, ciphertext)
  }

  /**
   * List moderators
   *
   * @return    {Array<String>}      Array of moderator DIDs
   */
  async listModerators () {
    this._requireLoad()
    return this._db.access.capabilities.moderators
  }

  /**
   * Add a member to this thread, throws if user can not add member, throw is not member thread
   *
   * @param     {String}    id                      Member Id
   */
  async addMember (id, ciphertext) {
      // TODO dont pass ciphtext here, if access, user as sym key, and this func can enc
    this._requireLoad()
    this._requireAuth()
    this._throwIfNotMembers()
    if (id.startsWith('0x')) {
      id = await API.getSpaceDID(id, this._spaceName)
    }
    // TODO if conf thread, also key pub key, and 3id encrypt to pubkey and did
    // TODO req or throw for ciphertext if confidentials thread
    if (!isValid3ID(id)) throw new Error('addMember: must provide valid 3ID')
    this._throwIfNotMembers()
    return this._db.access.grant(MEMBER, id, ciphertext)
  }

  /**
   * List members, throws if not member thread
   *
   * @return    {Array<String>}      Array of member DIDs
   */
  async listMembers () {
    this._throwIfNotMembers()
    this._requireLoad()
    return this._db.access.capabilities.members
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
    this._requireAuth()
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
    const decrypt = async (entry) => {
      if (!this._confidential) return  entry
      const message = await this._3id.symDecrypt(this._symKey, entry.message)
      return {message, timestamp: entry.timestamp}
    }

    this._requireLoad()
    if (!opts.limit) opts.limit = -1
    return Promise.all(this._db.iterator(opts).collect().map(async entry => {
      console.log(entry.payload.value)
      const post = await decrypt(entry.payload.value)
      const metaData = { postId: entry.hash, author: entry.identity.id }
      return Object.assign(metaData, post)
    }))
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
    this._db = await this._replicator._orbitdb.feed(odbAddress || this._name, {
      ...ORBITDB_OPTS,
      accessController: this._accessController
    })
    await this._db.load()
    this._address = this._db.address.toString()
    this._replicator.ensureConnected(this._address, true)

    return this._address
  }

  async _initConfidential() {
    if (this._symKey) {
      const ciphertext = await this._3id.encrypt(JSON.stringify({symKey: this._symKey}), this._spaceName)
      await this.addModerator(this._firstModerator, ciphertext)
      // TODO will throw error if other than first mod is trying to add key for mod, cathch and return clear error
    } else {
      const encKey = this._db.access.getEncryptedKey(this._3id.getSubDID(this._spaceName))
      this._symKey = await this._3id.decrypt(encKey, this._spaceName)
    }
  }

  _requireLoad () {
    if (!this._db) throw new Error('_load must be called before interacting with the store')
  }

  _requireAuth () {
    if (!this._authenticated) throw new Error('You must authenticate before performing this action')
  }

  async close () {
    this._requireLoad()
    await this._db.close()
  }

  _setIdentity (odbId) {
    this._db.setIdentity(odbId)
    this._db.access._db.setIdentity(odbId)
    this._authenticated = true
  }

  async _initConfigs () {
    if (this._accessController) return
    if (this._firstModerator.startsWith('0x')) {
      this._firstModerator = await API.getSpaceDID(this._firstModerator, this._spaceName)
    }
    this._accessController = {
      type: 'thread-access',
      threadName: this._name,
      members: this._members,
      firstModerator: this._firstModerator
    }
    // TODO change name, and maybe pass defualt value through so object same, like 'public' if not enc
    if (this._keyHashId) {
      this._accessController.keyHashId = this._keyHashId
    }
  }
}

module.exports = Thread
