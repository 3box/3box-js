const OrbitDB = require('orbit-db')
const Multihash = require('multihashes')
const nacl = require('tweetnacl')

const SALT_KEY = '3BOX_SALT'

class PrivateStore {
  /**
   * Instantiates a PrivateStore
   *
   * @param     {MuPort}    muportDID                   A MuPort DID instance
   * @param     {IPFS}      ipfs                        An instance of the ipfs api
   * @param     {function}  updateRoot                  A callback function that is called when the store has been updated
   * @return    {PrivateStore}                          self
   */
  constructor(muportDID, ipfs, updateRoot) {
    this.muportDID = muportDID
    this.ipfs = ipfs
    this.updateRoot = updateRoot
  }

  /**
   * Get the value of the given key
   *
   * @param     {String}    key                     the key
   * @return    {String}                            the value associated with the key
   */
  async get (key) {
    if (!this.db) throw new Error('_sync must be called before interacting with the store')
    if (key === SALT_KEY) throw new Error('Invalid key')

    const encryptedEntry = await this.db.get(this._genDbKey(key))
    return encryptedEntry ? this._decryptEntry(encryptedEntry) : null
  }

  /**
   * Set a value for the given key
   *
   * @param     {String}    key                     the key
   * @param     {String}    value                   the value
   * @return    {Boolean}                           true if successful
   */
  async set (key, value) {
    if (!this.db) throw new Error('_sync must be called before interacting with the store')
    if (key === SALT_KEY) throw new Error('Invalid key')

    if (value != null) {
      value = this._encryptEntry(value)
    }
    const dbKey = this._genDbKey(key)

    // TODO - error handling
    const multihash = await this.db.put(dbKey, value)
    this.updateRoot(multihash)
    return true
  }

  /**
   * Remove the value for the given key
   *
   * @param     {String}    key                     the key
   * @return    {Boolean}                           true if successful
   */
  async remove (key) {
    return this.set(key, null)
  }

  /**
   * Sync the private store with the given ipfs hash
   *
   * @param     {String}    hash                        The hash of the private store OrbitDB
   */
  async _sync (hash) {
    if (!this.db) {
      const orbitdb = new OrbitDB(this.ipfs)
      this.db = await orbitdb.keyvalue('3box.datastore', {
        replicate: false,
        write: ['*']
      })
    }
    if (hash) {
      await this.db.sync([{hash: hash}])
      // sync orbitdb to hash
      const encryptedSalt = await this.db.get(SALT_KEY)
      this.salt = this._decryptEntry(encryptedSalt)
    } else {
      this.salt = Buffer.from(nacl.randomBytes(16)).toString('hex')
      const encryptedSalt = this._encryptEntry(this.salt)
      await this.db.put(SALT_KEY, encryptedSalt)
    }
  }

  async close () {
    this.db.close()
  }

  _genDbKey (key) {
    const dataBuf = Buffer.from(this.salt + key, 'utf8')
    return Multihash.encode(dataBuf, 'sha3-256').toString('hex')
  }

  _encryptEntry (entry) {
    const encrypted = this.muportDID.symEncrypt(entry)
    return encrypted.nonce + '.' + encrypted.ciphertext
  }

  _decryptEntry (entry) {
    let [nonce, ciphertext] = entry.split('.')
    return this.muportDID.symDecrypt(ciphertext, nonce)
  }
}

module.exports = PrivateStore
