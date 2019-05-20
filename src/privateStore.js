const KeyValueStore = require('./keyValueStore')
const utils = require('./utils/index')

const ENC_BLOCK_SIZE = 24

class PrivateStore extends KeyValueStore {
  constructor (orbitdb, name, ensureConnected, _3id) {
    super(orbitdb, name, ensureConnected, _3id)
    this.keyring = _3id.getKeyringBySpaceName(name)
    this._salt = this.keyring.getDBSalt()
  }

  async get (key, opts = {}) {
    const entry = await super.get(this._genDbKey(key), opts)
    if (!entry) {
      return null
    }

    if (opts.metadata) {
      return {
        ...entry,
        value: this._decryptEntry(entry.value)
      }
    }

    return this._decryptEntry(entry)
  }

  async getMetadata (key) {
    // Note: assumes metadata is not encrypted.
    return super.getMetadata(this._genDbKey(key))
  }

  async set (key, value) {
    value = this._encryptEntry(value)
    key = this._genDbKey(key)
    return super.set(key, value)
  }

  async setMultiple (keys, values) {
    utils.throwIfNotEqualLenArrays(keys, values)
    const dbKeys = keys.map(this._genDbKey, this)
    const encryptedValues = values.map(this._encryptEntry, this)
    return super.setMultiple(dbKeys, encryptedValues)
  }

  async remove (key) {
    key = this._genDbKey(key)
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
  get log () {
    return super.log.map(obj => {
      return Object.assign(obj, { value: obj.value ? this._decryptEntry(obj.value) : null })
    })
  }

  _genDbKey (key) {
    utils.throwIfUndefined(key, 'key')
    return utils.sha256Multihash(this._salt + key)
  }

  _encryptEntry (entry) {
    if (typeof entry === 'undefined') throw new Error('Entry to encrypt cannot be undefined')

    return this.keyring.symEncrypt(this._pad(JSON.stringify(entry)))
  }

  _decryptEntry ({ ciphertext, nonce }) {
    return JSON.parse(this._unpad(this.keyring.symDecrypt(ciphertext, nonce)))
  }

  _pad (val, blockSize = ENC_BLOCK_SIZE) {
    const blockDiff = (blockSize - (val.length % blockSize)) % blockSize
    return `${val}${'\0'.repeat(blockDiff)}`
  }

  _unpad (padded) {
    return padded.replace(/\0+$/, '')
  }
}

module.exports = PrivateStore
