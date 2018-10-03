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
    if (!this._db) throw new Error('_sync must be called before interacting with the store')
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
    if (!this._db) throw new Error('_sync must be called before interacting with the store')
    const timestamp = new Date().getTime()
    await this._db.put(key, { value, timestamp })
    return true
  }

  /**
   * Remove the value for the given key
   *
   * @param     {String}    key                     the key
   * @return    {Boolean}                           true if successful
   */
  async remove (key) {
    if (!this._db) throw new Error('_sync must be called before interacting with the store')
    await this._db.del(key)
    return true
  }

  async _sync (orbitAddress) {
    if (orbitAddress) {
      this._db = await this._orbitdb.open(orbitAddress)
      const readyPromise = new Promise((resolve, reject) => {
        this._db.events.on('ready', resolve)
      })
      this._db.load()
      await readyPromise
      // wait for a while to see if we get updates from the network
      await new Promise((resolve, reject) => {
        let toid = setTimeout(() => {
          this._db.events.removeAllListeners('replicated')
          this._db.events.removeAllListeners('replicate.progress')
          resolve()
        }, 2000)
        this._db.events.on('replicate.progress', (_x, _y, _z, num, max) => {
          if (toid) {
            clearTimeout(toid)
            toid = null
          }
          if (num === max) {
            this._db.events.on('replicated', resolve)
          }
        })
      })
    } else {
      this._db = await this._orbitdb.keyvalue(this._name)
    }
    return this._db.address.toString()
  }

  async close () {
    if (!this._db) throw new Error('_sync must be called before interacting with the store')
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
   *  // { op: 'PUT', key: 'Name', value: 'Botbot', timestamp: '1538575416068' }
   *
   * @return    {Array<Object>}     Array of ordered log entry objects
   */
  get log () {
    return this._db._oplog.values.map(obj => {
      return { op: obj.payload.op,
        key: obj.payload.key,
        value: obj.payload.value ? obj.payload.value.value : null,
        timestamp: obj.payload.value ? obj.payload.value.timestamp : null }
    })
  }
}

module.exports = KeyValueStore
