class KeyValueStore {
  /**
   * Please use **threeBox.profileStore** or **threeBox.profileStore** to get the instance of this class
   */
  constructor (orbitdb, name) {
    this._orbitdb = orbitdb
    this._name = name
  }

  /**
   * Get the value of the given key
   *
   * @param     {String}    key                     the key
   * @return    {String}                            the value associated with the key
   */
  async get (key) {
    this._requireLoad()
    const dbGetRes = await this._db.get(key)
    return dbGetRes ? dbGetRes.value : dbGetRes
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
    await this._db.del(key)
    return true
  }

  async _sync (numRemoteEntries) {
    this._requireLoad()
    let toid = null
    if (numRemoteEntries === this._db._oplog.values.length) return Promise.resolve()
    await new Promise((resolve, reject) => {
      if (!numRemoteEntries) {
        toid = setTimeout(() => {
          this._db.events.removeAllListeners('replicated')
          this._db.events.removeAllListeners('replicate.progress')
          resolve()
        }, 3000)
      }
      this._db.events.on('replicate.progress', (_x, _y, _z, num, max) => {
        if (toid) {
          clearTimeout(toid)
          toid = null
        }
        const total = numRemoteEntries || max
        if (num >= total) this._db.events.on('replicated', resolve)
      })
    })
    return this._db.address.toString()
  }

  async _load () {
    this._db = await this._orbitdb.keyvalue(this._name)
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
