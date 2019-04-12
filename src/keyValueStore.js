class KeyValueStore {
  /**
   * Please use **box.public** or **box.private** to get the instance of this class
   */
  constructor (orbitdb, name, ensureConnected, threeId) {
    this._orbitdb = orbitdb
    this._name = name
    this._ensureConnected = ensureConnected
    this._3id = threeId
  }

  /**
   * Get the value of the given key
   *
   * @param     {String}    key                     the key
   * @return    {String}                            the value associated with the key, undefined if there's no such key
   */
  async get (key) {
    const x = await this._get(key)
    return x ? x.value : x
  }

  /**
   * Get metadata for for a given key
   *
   * @param     {String}    key                     the key
   * @return    {Metadata}                          Metadata for the key, undefined if there's no such key
   */
  async getMetadata (key) {
    const x = await this._get(key)
    return x ? { timestamp: x.timeStamp } : x
  }

  /**
   * Set a value for the given key
   *
   * @param     {String}    key                     the key
   * @param     {String}    value                   the value
   * @return    {Boolean}                           true if successful
   */
  async set (key, value) {
    this._requireLoad()
    this._ensureConnected()
    const timeStamp = new Date().getTime()
    await this._db.put(key, { value, timeStamp })
    return true
  }

  /**
   * Remove the value for the given key
   *
   * @param     {String}    key                     the key
   * @return    {Boolean}                           true if successful
   */
  async remove (key) {
    this._requireLoad()
    this._ensureConnected()
    await this._db.del(key)
    return true
  }

  /**
   * Get the raw value of the given key
   * @private
   *
   * @param     {String}    key                     the key
   * @return    {String}                            the value associated with the key
   */
  async _get (key) {
    this._requireLoad()
    return this._db.get(key)
  }

  async _sync (numRemoteEntries) {
    this._requireLoad()
    // let toid = null
    const numEntriesDefined = !(numRemoteEntries === null || numRemoteEntries === undefined)
    if (numEntriesDefined && numRemoteEntries <= this._db._oplog.values.length) return Promise.resolve()
    await new Promise((resolve, reject) => {
      if (!numRemoteEntries) {
        setTimeout(() => {
          this._db.events.removeAllListeners('replicated')
          this._db.events.removeAllListeners('replicate.progress')
          resolve()
        }, 3000)
      }
      this._db.events.on('replicated', () => {
        if (numRemoteEntries <= this._db._oplog.values.length) resolve()
      })
      /*
      this._db.events.on('replicate.progress', (_x, _y, _z, num, max) => {
        if (toid) {
          clearTimeout(toid)
          toid = null
        }
        const total = numRemoteEntries || max
        if (num >= total) {
          this._db.events.on('replicated', resolve)
          listenerAdded = true
        }
      })
      */
    })
    return this._db.address.toString()
  }

  async _load (odbAddress) {
    const key = this._3id.getKeyringBySpaceName(this._name).getDBKey()
    this._db = await this._orbitdb.keyvalue(odbAddress || this._name, {
      key,
      write: [key.getPublic('hex')]
    })
    await this._db.load()
    return this._db.address.toString()
  }

  _requireLoad () {
    if (!this._db) throw new Error('_load must be called before interacting with the store')
  }

  async close () {
    this._requireLoad()
    await this._db.close()
  }

  async all () {
    this._requireLoad()
    const entries = await this._db.all()
    let allSimple = {}
    Object.keys(entries).map(key => { allSimple[key] = entries[key].value })
    return allSimple
  }

  /**
   * Returns array of underlying log entries. In linearized order according to their Lamport clocks.
   * Useful for generating a complete history of all operations on store.
   *
   *  @example
   *  const log = store.log
   *  const entry = log[0]
   *  console.log(entry)
   *  // { op: 'PUT', key: 'Name', value: 'Botbot', timeStamp: '1538575416068' }
   *
   * @return    {Array<Object>}     Array of ordered log entry objects
   */
  get log () {
    return this._db._oplog.values.map(obj => {
      return { op: obj.payload.op,
        key: obj.payload.key,
        value: obj.payload.value ? obj.payload.value.value : null,
        timeStamp: obj.payload.value ? obj.payload.value.timeStamp : null }
    })
  }
}

module.exports = KeyValueStore
