const KeyValueStore = require('./keyValueStore')
const { sha256Multihash } = require('./utils')

const ENC_BLOCK_SIZE = 24
const nameToSpaceName = name => `3box.space.${name}.keyvalue`

class Space {
  /**
   * Please use **box.openSpace** to get the instance of this class
   */
  constructor (name, threeId, orbitdb, rootStore, ensureConnected) {
    this._name = name
    this._3id = threeId
    this._store = new KeyValueStore(orbitdb, nameToSpaceName(this._name), ensureConnected, this._3id)
    this._rootStore = rootStore
    /**
     * @property {KeyValueStore} public         access the profile store of the space
     */
    this.public = null
    /**
     * @property {KeyValueStore} private        access the private store of the space
     */
    this.private = null
  }

  async open (opts = {}) {
    if (!this._store._db) {
      // store is not loaded opened yet
      const consentNeeded = await this._3id.initKeyringByName(this._name)
      if (opts.consentCallback) opts.consentCallback(consentNeeded, this._name)
      const spaceAddress = await this._store._load()

      const entries = await this._rootStore.iterator({ limit: -1 }).collect()
      if (!entries.find(entry => entry.payload.value.odbAddress.indexOf(nameToSpaceName(this._name)) !== -1)) {
        this._rootStore.add({ odbAddress: spaceAddress })
      }
      const syncSpace = async () => {
        await this._store._sync(opts.numEntries || null)
        if (opts.onSyncDone) opts.onSyncDone()
      }
      syncSpace()
      this.public = publicStoreReducer(this._store)
      this.private = privateStoreReducer(this._store, this._3id.getKeyringBySpaceName(nameToSpaceName(this._name)))
    }
  }
}

module.exports = Space

const publicStoreReducer = (store) => {
  const PREFIX = 'pub_'
  return {
    get: async key => store.get(PREFIX + key),
    set: async (key, value) => store.set(PREFIX + key, value),
    remove: async key => store.remove(PREFIX + key),
    get log () {
      return store.log.reduce((newLog, entry) => {
        if (entry.key.startsWith(PREFIX)) {
          entry.key = entry.key.slice(4)
          newLog.push(entry)
        }
        return newLog
      }, [])
    },
    all: async () => {
      const entries = await store.all()
      return Object.keys(entries).reduce((newAll, key) => {
        if (key.startsWith(PREFIX)) {
          newAll[key.slice(4)] = entries[key]
        }
        return newAll
      }, {})
    }
  }
}

const privateStoreReducer = (store, keyring) => {
  const PREFIX = 'priv_'
  const SALT = keyring.getDBSalt()
  const dbKey = key => PREFIX + sha256Multihash(SALT + key)
  const pad = (val, blockSize = ENC_BLOCK_SIZE) => {
    const blockDiff = (blockSize - (val.length % blockSize)) % blockSize
    return `${val}${'\0'.repeat(blockDiff)}`
  }
  const unpad = padded => padded.replace(/\0+$/, '')
  const encryptEntry = entry => keyring.symEncrypt(pad(JSON.stringify(entry)))
  const decryptEntry = ({ ciphertext, nonce }) => {
    return JSON.parse(unpad(keyring.symDecrypt(ciphertext, nonce)))
  }
  return {
    get: async key => {
      const entry = await store.get(dbKey(key))
      return entry ? decryptEntry(entry).value : null
    },
    set: async (key, value) => store.set(dbKey(key), encryptEntry({ key, value })),
    remove: async key => store.remove(dbKey(key)),
    get log () {
      return store.log.reduce((newLog, entry) => {
        if (entry.key.startsWith(PREFIX)) {
          const decEntry = decryptEntry(entry.value)
          entry.key = decEntry.key
          entry.value = decEntry.value
          newLog.push(entry)
        }
        return newLog
      }, [])
    },
    all: async () => {
      const entries = await store.all()
      return Object.keys(entries).reduce((newAll, key) => {
        if (key.startsWith(PREFIX)) {
          const decEntry = decryptEntry(entries[key])
          newAll[decEntry.key] = decEntry.value
        }
        return newAll
      }, {})
    }
  }
}
