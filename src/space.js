const KeyValueStore = require('./keyValueStore')
const Thread = require('./thread')
const GhostThread = require('./ghost')
const { throwIfUndefined, throwIfNotEqualLenArrays } = require('./utils')
const OrbitDBAddress = require('orbit-db/src/orbit-db-address')

const nameToSpaceName = name => `3box.space.${name}.keyvalue`
const namesTothreadName = (spaceName, threadName) => `3box.thread.${spaceName}.${threadName}`
const namesToChatName = (spaceName, chatName) => `3box.ghost.${spaceName}.${chatName}`

class Space {
  /**
   * Please use **box.openSpace** to get the instance of this class
   */
  constructor (name, replicator) {
    this._name = name
    this._replicator = replicator
    this._store = new KeyValueStore(nameToSpaceName(this._name), this._replicator)
    this._activeThreads = {}
    /**
     * @property {KeyValueStore} public         access the profile store of the space
     */
    this.public = null
    /**
     * @property {KeyValueStore} private        access the private store of the space
     */
    this.private = null
    /**
     * @property {Promise}       syncDone       A promise that is resolved when the space data is synced
     */
    this.syncDone = null
  }

  /**
   * @property {String} DID        the did of the user in this space
   */
  get DID () {
    return this._3id.getSubDID(this._name)
  }

  get isOpen () {
    return Boolean(this._store._db)
  }

  async open (threeId, opts = {}) {
    if (!this.isOpen) {
      // store is not loaded opened yet
      this._3id = threeId
      const authenticated = await this._3id.isAuthenticated([this._name])
      if (!authenticated) {
        await this._3id.authenticate([this._name])
      }
      if (opts.consentCallback) opts.consentCallback(!authenticated, this._name)
      await this._store._load(this._3id)

      const syncSpace = async () => {
        await this._store._sync()
        if (opts.onSyncDone) opts.onSyncDone()
      }
      this.syncDone = syncSpace()
      this.public = publicStoreReducer(this._store)
      this.private = privateStoreReducer(this._store, this._3id, this._name)
      // make sure we're authenticated to all threads
      await this._authThreads(this._3id)
    }
  }

  async _authThreads (threeId) {
    const odbIdentity = await threeId.getOdbId(this._name)
    Object.values(this._activeThreads).forEach(thread => {
      if (thread.isGhost) {
        thread._set3id(this._3id)
      } else {
        thread._setIdentity(odbIdentity)
      }
    })
  }

  /**
   * Join a thread. Use this to start receiving updates from, and to post in threads
   *
   * @param     {String}    name                    The name of the thread
   * @param     {Object}    opts                    Optional parameters
   * @param     {String}    opts.firstModerator     DID of first moderator of a thread, by default, user is first moderator
   * @param     {Boolean}   opts.members            join a members only thread, which only members can post in, defaults to open thread
   * @param     {Boolean}   opts.noAutoSub          Disable auto subscription to the thread when posting to it (default false)
   * @param     {Boolean}   opts.ghost              Enable ephemeral messaging via Ghost Thread
   * @param     {Number}    opts.ghostBacklogLimit  The number of posts to maintain in the ghost backlog
   * @param     {Array<Function>} opts.ghostFilters Array of functions for filtering messages
   *
   * @return    {Thread}                  An instance of the thread class for the joined thread
   */
  async joinThread (name, opts = {}) {
    if (opts.ghost) {
      const ghostAddress = namesToChatName(this._name, name)
      if (!this._activeThreads[ghostAddress]) {
        this._activeThreads[ghostAddress] = new GhostThread(ghostAddress, this._replicator, this._3id, opts)
      }
      if (this._3id) {
        this._activeThreads[ghostAddress]._set3id(this._3id)
      }
      return this._activeThreads[ghostAddress]
    } else {
      const subscribeFn = opts.noAutoSub ? () => {} : this.subscribeThread.bind(this)
      if (!opts.firstModerator) {
        if (!this._3id) throw new Error('firstModerator required if not authenticated')
        opts.firstModerator = this._3id.getSubDID(this._name)
      }
      const thread = new Thread(namesTothreadName(this._name, name), this._replicator, opts.members, opts.firstModerator, subscribeFn)
      const address = await thread._getThreadAddress()
      if (this._activeThreads[address]) return this._activeThreads[address]
      await thread._load()
      if (this._3id) {
        thread._setIdentity(await this._3id.getOdbId(this._name))
      }
      this._activeThreads[address] = thread
      return thread
    }
  }

  /**
   * Join a thread by full thread address. Use this to start receiving updates from, and to post in threads
   *
   * @param     {String}    address                 The full address of the thread
   * @param     {Object}    opts                    Optional parameters
   * @param     {Boolean}   opts.noAutoSub          Disable auto subscription to the thread when posting to it (default false)
   *
   * @return    {Thread}                            An instance of the thread class for the joined thread
   */
  async joinThreadByAddress (address, opts = {}) {
    if (!OrbitDBAddress.isValid(address)) throw new Error('joinThreadByAddress: valid orbitdb address required')
    if (!this.isOpen) throw new Error('joinThreadByAddress requires space to be open')
    const threadSpace = address.split('.')[2]
    const threadName = address.split('.')[3]
    if (threadSpace !== this._name) throw new Error('joinThreadByAddress: attempting to open thread from different space, must open within same space')
    if (this._activeThreads[address]) return this._activeThreads[address]
    const subscribeFn = opts.noAutoSub ? () => {} : this.subscribeThread.bind(this)
    const thread = new Thread(namesTothreadName(this._name, threadName), this._replicator, this._3id, opts.members, opts.firstModerator, subscribeFn)
    await thread._load(address)
    this._activeThreads[address] = thread
    return thread
  }

  /**
   * Subscribe to the given thread, if not already subscribed
   *
   * @param     {String}    address                The address of the thread
   * @param     {Object}    config                configuration and thread meta data
   * @param     {String}    opts.name             Name of thread
   * @param     {String}    opts.firstModerator   DID of the first moderator
   * @param     {String}    opts.members          Boolean string, true if a members only thread
   */
  async subscribeThread (address, config = {}) {
    if (!OrbitDBAddress.isValid(address)) throw new Error('subscribeThread: must subscribe to valid thread/orbitdb address')
    if (!this.isOpen) return // we can't subscribe if space isn't open
    const threadKey = `thread-${address}`
    await this.syncDone
    if (!(await this.public.get(threadKey))) {
      await this.public.set(threadKey, Object.assign({}, config, { address }))
    }
  }

  /**
   * Unsubscribe from the given thread, if subscribed
   *
   * @param     {String}    address     The address of the thread
   */
  async unsubscribeThread (address) {
    if (!this.isOpen) throw new Error('unsubscribeThread requires space to be open')
    const threadKey = `thread-${address}`
    if (await this.public.get(threadKey)) {
      await this.public.remove(threadKey)
    }
  }

  /**
   * Get a list of all the threads subscribed to in this space
   *
   * @return    {Array<Objects>}    A list of thread objects as { address, firstModerator, members, name}
   */
  async subscribedThreads () {
    if (!this.isOpen) throw new Error('subscribedThreads requires space to be open')
    const allEntries = await this.public.all()
    return Object.keys(allEntries).reduce((threads, key) => {
      if (key.startsWith('thread')) {
        // ignores experimental threads (v1)
        const address = key.split('thread-')[1]
        if (OrbitDBAddress.isValid(address)) {
          threads.push(allEntries[key])
        }
      }
      return threads
    }, [])
  }
}

module.exports = Space

const publicStoreReducer = (store) => {
  const PREFIX = 'pub_'
  return {
    get: async (key, opts = {}) => store.get(PREFIX + key, opts),
    getMetadata: async key => store.getMetadata(PREFIX + key),
    set: async (key, value) => {
      throwIfUndefined(key, 'key')
      return store.set(PREFIX + key, value)
    },
    setMultiple: async (keys, values) => {
      throwIfNotEqualLenArrays(keys, values)
      const prefixedKeys = keys.map(key => PREFIX + key)
      return store.setMultiple(prefixedKeys, values)
    },
    remove: async key => {
      throwIfUndefined(key, 'key')
      return store.remove(PREFIX + key)
    },
    async log () {
      return (await store.log()).reduce((newLog, entry) => {
        if (entry.key.startsWith(PREFIX)) {
          entry.key = entry.key.slice(4)
          newLog.push(entry)
        }
        return newLog
      }, [])
    },
    all: async (opts) => {
      const entries = await store.all(opts)
      return Object.keys(entries).reduce((newAll, key) => {
        if (key.startsWith(PREFIX)) {
          newAll[key.slice(4)] = entries[key]
        }
        return newAll
      }, {})
    }
  }
}

const privateStoreReducer = (store, threeId, spaceName) => {
  const PREFIX = 'priv_'
  const dbKey = async key => {
    throwIfUndefined(key, 'key')
    return PREFIX + await threeId.hashDBKey(key, spaceName)
  }
  const encryptEntry = async entry => threeId.encrypt(JSON.stringify(entry), spaceName)
  const decryptEntry = async encObj => JSON.parse(await threeId.decrypt(encObj, spaceName))
  return {
    get: async (key, opts = {}) => {
      const entry = await store.get(await dbKey(key), opts)

      if (!entry) {
        return null
      }

      if (opts.metadata) {
        return {
          ...entry,
          value: (await decryptEntry(entry.value)).value
        }
      }

      return (await decryptEntry(entry)).value
    },
    getMetadata: async key => store.getMetadata(await dbKey(key)),
    set: async (key, value) => store.set(await dbKey(key), await encryptEntry({ key, value })),
    setMultiple: async (keys, values) => {
      throwIfNotEqualLenArrays(keys, values)
      const dbKeys = await Promise.all(keys.map(dbKey))
      const encryptedEntries = await Promise.all(
        values.map((value, index) => encryptEntry({ key: keys[index], value }))
      )
      return store.setMultiple(dbKeys, encryptedEntries)
    },
    remove: async key => store.remove(await dbKey(key)),
    async log () {
      const log = await store.log()
      const privLog = []
      for (const entry of log) {
        if (entry.key.startsWith(PREFIX)) {
          const decEntry = await decryptEntry(entry.value)
          entry.key = decEntry.key
          entry.value = decEntry.value
          privLog.push(entry)
        }
      }
      return privLog
    },
    all: async (opts = {}) => {
      const entries = await store.all(opts)
      const privEntries = {}
      for (const key in entries) {
        if (key.startsWith(PREFIX)) {
          const entry = entries[key]

          if (opts.metadata) {
            const decEntry = await decryptEntry(entry.value)
            privEntries[decEntry.key] = {
              ...entry,
              value: decEntry.value
            }
          } else {
            const decEntry = await decryptEntry(entry)
            privEntries[decEntry.key] = decEntry.value
          }
        }
      }
      return privEntries
    }
  }
}
