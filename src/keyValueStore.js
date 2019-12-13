const { throwIfUndefined, throwIfNotEqualLenArrays } = require('./utils/index')

class KeyValueStore {
  /**
   * Please use **box.public** or **box.private** to get the instance of this class
   */
  constructor (name, replicator, threeId) {
    this._name = name
    this._replicator = replicator
    if (this._name.startsWith('3box.space.')) {
      this._space = this._name.split('.')[2]
    }
    this._3id = threeId
  }

  /**
   * Get the value and optionally metadata of the given key
   *
   * @param     {String}    key                             the key
   * @param     {Object}    opts                            optional parameters
   * @param     {Boolean}   opts.metadata                   return both value and metadata
   * @return    {String|{value: String, timestamp: Number}} the value associated with the key, undefined if there's no such key
   */
  async get (key, opts = {}) {
    const x = await this._get(key)

    if (!x) {
      return x
    }

    if (opts.metadata) {
      const metadata = this._extractMetadata(x)
      return {
        ...metadata,
        value: x.value
      }
    }

    return x.value
  }

  /**
   * Get metadata for for a given key
   *
   * @param     {String}    key                     the key
   * @return    {Metadata}                          Metadata for the key, undefined if there's no such key
   */
  async getMetadata (key) {
    const x = await this._get(key)

    if (!x) {
      return x
    }

    return this._extractMetadata(x)
  }

  /**
   * Set a value for the given key
   *
   * @param     {String}    key                     the key
   * @param     {String}    value                   the value
   * @return    {Boolean}                           true if successful
   */
  async set (key, value) {
    throwIfUndefined(key, 'key')
    this._requireLoad()
    this._replicator.ensureConnected(this._db.address.toString())
    const timeStamp = new Date().getTime()
    await this._db.put(key, { value, timeStamp })
    return true
  }

  /**
  * Set multiple values for multiple keys
  *
  * @param     {Array<String>}    keys                     the keys
  * @param     {Array<String>}    values                   the values
  * @return    {Boolean}                                  true if successful, throw error if not
  */
  async setMultiple (keys, values) {
    throwIfNotEqualLenArrays(keys, values)
    this._requireLoad()
    this._replicator.ensureConnected(this._db.address.toString())
    try {
      await keys.reduce(async (previousPromise, nextKey, index) => {
        await previousPromise
        throwIfUndefined(nextKey, 'key')
        const timeStamp = new Date().getTime()
        return this._db.put(nextKey, { value: values[index], timeStamp })
      }, Promise.resolve())
      return true
    } catch (error) {
      throw new Error(error)
    }
  }

  /**
   * Remove the value for the given key
   *
   * @param     {String}    key                     the key
   * @return    {Boolean}                           true if successful
   */
  async remove (key) {
    throwIfUndefined(key, 'key')
    this._requireLoad()
    this._replicator.ensureConnected(this._db.address.toString())
    await this._db.del(key)
    return true
  }

  /**
   * Extract metadata from store object
   * @private
   * @param x {Object} data from store
   * @return {Metadata} store metadata
   */
  _extractMetadata (x) {
    // ms -> seconds, see issue #396 for details
    const timestamp = Math.floor(x.timeStamp / 1000)

    return { timestamp }
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

  async _sync () {
    this._requireLoad()
    await this._replicator.syncDB(this._db)
    return this._db.address.toString()
  }

  async _load (threeId) {
    this._3id = threeId || this._3id
    const odbAddress = this._replicator.listStoreAddresses().find(odbAddress => odbAddress.includes(this._name))
    if (odbAddress) {
      this._db = await this._replicator.getStore(odbAddress)
    } else {
      const key = (await this._3id.getPublicKeys(this._space, true)).signingKey
      this._db = await this._replicator.addKVStore(this._name, key, Boolean(this._space), this._3id.getSubDID(this._space))
    }
    // when this._space is undefined it will use the root identity
    const odbIdentity = await this._3id.getOdbId(this._space)
    this._db.setIdentity(odbIdentity)
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
   * Get all values and optionally metadata
   *
   * @param     {Object}    opts                                    optional parameters
   * @param     {Boolean}   opts.metadata                           return both values and metadata
   * @return    {Array<String|{value: String, timestamp: Number}>}  the values
   */
  async all (opts = {}) {
    this._requireLoad()
    const entries = this._db.all
    const allSimple = {}
    Object.keys(entries).map(key => {
      const entry = entries[key]

      if (opts.metadata) {
        allSimple[key] = {
          ...this._extractMetadata(entry),
          value: entry.value
        }
      } else {
        allSimple[key] = entry.value
      }
    })

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
  async log () {
    return this._db._oplog.values.map(obj => {
      return {
        op: obj.payload.op,
        key: obj.payload.key,
        value: obj.payload.value ? obj.payload.value.value : null,
        timeStamp: obj.payload.value ? obj.payload.value.timeStamp : null
      }
    })
  }
}

module.exports = KeyValueStore
