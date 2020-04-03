const isIPFS = require('is-ipfs')
const API = require('./api')
const config = require('./config')
const { symEncryptBase, symDecryptBase, newSymKey } = require('./3id/utils')
const utils = require('./utils/index')
const orbitAddress = require('orbit-db/src/orbit-db-address')

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
  constructor (name, replicator, members, firstModerator, confidential, user, subscribe) {
    this._name = name
    this._replicator = replicator
    this._spaceName = name ? name.split('.')[2] : undefined
    this._subscribe = subscribe
    this._queuedNewPosts = []
    this._members = Boolean(members)
    this._firstModerator = firstModerator
    this._user = user

    if (confidential) {
      this._confidential = true
      this._members = true
      if (typeof confidential === 'string') {
        this._encKeyId = confidential
      } else {
        this._symKey = newSymKey()
        this._encKeyId = utils.sha256(this._symKey)
      }
    }
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

    if (this._confidential) message = this._symEncrypt(message)

    return this._db.add({
      message,
      timestamp
    })
  }

  get address () {
    return this._db ? this._address : null
  }

  async _getThreadAddress () {
    if (this._address) return this._address
    await this._initAcConfigs()
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
  async addModerator (id) {
    this._requireLoad()
    this._requireAuth()

    if (id.startsWith('0x')) {
      id = await API.getSpaceDID(id, this._spaceName)
    }

    if (!isValid3ID(id)) throw new Error('addModerator: must provide valid 3ID')

    return this._db.access.grant(MODERATOR, id, await this._encryptSymKey(id))
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
  async addMember (id) {
    this._requireLoad()
    this._requireAuth()
    this._throwIfNotMembers()
    if (id.startsWith('0x')) {
      id = await API.getSpaceDID(id, this._spaceName)
    }
    if (!isValid3ID(id)) throw new Error('addMember: must provide valid 3ID')

    return this._db.access.grant(MEMBER, id, await this._encryptSymKey(id))
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
    const decrypt = (entry) => {
      if (!this._confidential) return entry
      const message = this._symDecrypt(entry.message)
      return { message, timestamp: entry.timestamp }
    }

    this._requireLoad()
    if (!opts.limit) opts.limit = -1
    return this._db.iterator(opts).collect().map(entry => {
      const post = decrypt(entry.payload.value)
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

  // Loads by orbitdb address or db name
  async _load (dbString) {
    const loadByAddress = dbString && orbitAddress.isValid(dbString)
    if (!loadByAddress) await this._initAcConfigs()

    this._db = await this._replicator._orbitdb.feed(dbString || this._name, {
      ...ORBITDB_OPTS,
      accessController: this._accessController
    })

    await this._db.load()

    if (loadByAddress) {
      this._firstModerator = this._db.access._firstModerator
      this._members = this._db.access._members
      this._encKeyId = this._db.access._encKeyId
      this._confidential = Boolean(this._db.access._encKeyId)
      this._name = this._db.address.path
      this._spaceName = this._name.split('.')[2]
    }

    this._address = this._db.address.toString()
    this._replicator.ensureConnected(this._address, true)

    return this._address
  }

  async _initConfidential () {
    if (this._symKey) {
      if (this._user.DID !== this._firstModerator) throw new Error('_initConfidential: firstModerator must initialize a confidential thread')
      await this._db.access.grant(MODERATOR, this._firstModerator, await this._encryptSymKey())
    } else {
      let encryptedKey = null
      try {
        encryptedKey = this._db.access.getEncryptedKey(this._user.DID)
      } catch (e) {
        encryptedKey = await new Promise((resolve, reject) => {
          this.onNewCapabilities((val) => {
            let key = null
            try {
              key = this._db.access.getEncryptedKey(this._user.DID)
            } catch (e) { }
            if (key !== null) resolve(key)
          })
          setTimeout(() => resolve(null), 10000)
        })
      }
      if (!encryptedKey) throw new Error(`_initConfidential:  no access for ${this._user.DID}`)
      this._symKey = await this._decryptSymKey(encryptedKey)
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

  async _setIdentity (odbId) {
    this._db.setIdentity(odbId)
    this._db.access._db.setIdentity(odbId)
    this._authenticated = true
    // TODO not too clear hear, but does require auth, and to be after load
    if (this._confidential) {
      await this._initConfidential()
    }
  }

  async _initAcConfigs () {
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

    if (this._encKeyId) {
      this._accessController.encKeyId = this._encKeyId
    }
  }

  _symEncrypt (message) {
    const msg = utils.pad(JSON.stringify(message))
    return symEncryptBase(msg, this._symKey)
  }

  _symDecrypt (payload) {
    const paddedMsg = symDecryptBase(payload.ciphertext, this._symKey, payload.nonce)
    return JSON.parse(utils.unpad(paddedMsg))
  }

  async _encryptSymKey (to) {
    if (!this._confidential) return null
    return this._user.encrypt(this._symKey, { to })
  }

  async _decryptSymKey (encKey) {
    const key = await this._user.decrypt(encKey, true)
    return new Uint8Array(key)
  }
}

module.exports = Thread
