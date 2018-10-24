const KeyValueStore = require('./keyValueStore')
const utils = require('./utils')
const nacl = require('tweetnacl')

const SALT_KEY = '3BOX_SALT'
const ENC_BLOCK_SIZE = 24

class PrivateStore extends KeyValueStore {
  constructor (muportDID, orbitdb, name) {
    super(orbitdb, name)
    this.muportDID = muportDID
  }

  async get (key) {
    const encryptedEntry = await super.get(this._genDbKey(key))
    return encryptedEntry ? this._decryptEntry(encryptedEntry) : null
  }

  async set (key, value) {
    value = this._encryptEntry(value)
    key = this._genDbKey(key)
    return super.set(key, value)
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

  async _sync (orbitAddress) {
    const address = await super._sync(orbitAddress)
    let encryptedSalt = await super.get(SALT_KEY)
    if (encryptedSalt) {
      this._salt = this._decryptEntry(encryptedSalt)
    } else {
      this._salt = Buffer.from(nacl.randomBytes(16)).toString('hex')
      encryptedSalt = this._encryptEntry(this._salt)
      await super.set(SALT_KEY, encryptedSalt)
    }
    return address
  }

  _genDbKey (key) {
    return utils.sha256Multihash(this._salt + key)
  }

  _encryptEntry (entry) {
    if (typeof entry === 'undefined') throw new Error('Entry to encrypt cannot be undefined')

    return this.muportDID.symEncrypt(this._pad(JSON.stringify(entry)))
  }

  _decryptEntry ({ ciphertext, nonce }) {
    return JSON.parse(this._unpad(this.muportDID.symDecrypt(ciphertext, nonce)))
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
