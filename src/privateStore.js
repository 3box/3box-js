const OrbitDB = require('orbit-db')

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

    const encryptedEntry = await this.db.get(this._genDbKey(key))

    return this._decryptEntry(encryptedEntry)
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

    const encryptedValue = this._encryptEntry(value)
    const dbKey = this._genDbKey(key)

    // TODO - error handling
    const multihash = await this.db.put(dbKey, encryptedValue)

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
    // if hash === null; create a new orbitdb instance.
    const orbitdb = new OrbitDB(ipfs)
    //TODO - sync the OrbitDB key-value store
  }

  _genDbKey (key) {
    // return someHashFunction(key + this.salt)
  }

  _encryptEntry (entry) {
    // TODO - use muport to encrypt entry
  }

  _decryptEntry (entry) {
    // TODO - use muport to decrypt entry
  }
}

// some sample code for  creating a log store
//orbitdb.log('hello', {replicate: false}).then(db => {
  //db.add('asdfasdf').then(h => {
    //const eve = db.get(h)
    //console.log(eve)
  //})
//}).catch(console.log)

module.exports = PrivateStore
