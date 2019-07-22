const KeyValueStore = require('./keyValueStore')
const utils = require('./utils/index')


class PrivateStore extends KeyValueStore {
  constructor (orbitdb, name, ensureConnected, _3id) {
    super(orbitdb, name, ensureConnected, _3id)
  }

  async get (key, opts = {}) {
    const entry = await super.get(await this._3id.hashDBKey(key), opts)
    if (!entry) {
      return null
    }

    if (opts.metadata) {
      return {
        ...entry,
        value: await this._decryptEntry(entry.value)
      }
    }

    return this._decryptEntry(entry)
  }

  async getMetadata (key) {
    // Note: assumes metadata is not encrypted.
    return super.getMetadata(await this._3id.hashDBKey(key))
  }

  async set (key, value) {
    utils.throwIfUndefined(key, 'key')
    value = await this._encryptEntry(value)
    key = await this._3id.hashDBKey(key)
    return super.set(key, value)
  }

  async setMultiple (keys, values) {
    utils.throwIfNotEqualLenArrays(keys, values)
    const dbKeys = await Promise.all(keys.map(key => this._3id.hashDBKey(key), this))
    const encryptedValues = await Promise.all(values.map(this._encryptEntry, this))
    return super.setMultiple(dbKeys, encryptedValues)
  }

  async remove (key) {
    utils.throwIfUndefined(key, 'key')
    key = await this._3id.hashDBKey(key)
    return super.remove(key)
  }

  /**
   * Returns array of underlying log entries. In linearized order according to their Lamport clocks.
   * Useful for generating a complete history of all operations on store. Key is hashed, so key is
   * not available from the private store.
   *
   *  @example
   *  const log = store.log
   *  const entry = log[0]
   *  console.log(entry)
   *  // { op: 'PUT', key: ...., value: 'Botbot', timeStamp: '1538575416068' }
   *
   * @return    {Array<Object>}     Array of ordered log entry objects
   */
  async log () {
    const encLog = await super.log()
    const log = []
    for (const entry of encLog) {
      log.push(Object.assign(
        entry,
        { value: entry.value ? await this._decryptEntry(entry.value) : null }
      ))
    }
    return log
  }

  async _encryptEntry (entry) {
    if (typeof entry === 'undefined') throw new Error('Entry to encrypt cannot be undefined')

    return this._3id.encrypt(JSON.stringify(entry))
  }

  async _decryptEntry (encObj) {
    return JSON.parse(await this._3id.decrypt(encObj))
  }
}

module.exports = PrivateStore
