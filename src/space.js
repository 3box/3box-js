const KeyValueStore = require('./keyValueStore')

class Space {
  constructor (name, threeId, orbitdb, rootStore, ensureConnected) {
    this._name = name
    this._3id = threeId
    this._store = new KeyValueStore(orbitdb, `3box.space.${name}`, ensureConnected, this._3id)
    this._rootStore = rootStore
  }

  async open (opts = {}) {
    if (!this._store._db) {
      // store is not loaded opened yet
      const consentNeeded = await this._3id.initKeyringByName(this._name)
      if (opts.consentCallback) opts.consentCallback(consentNeeded, this._name)
      const spaceAddress = await this._store._load()

      const entries = await this._rootStore.iterator({ limit: -1 }).collect()
      if (!entries.find(entry => entry.payload.value.odbAddress.split('.')[2] === this._name)) {
        this._rootStore.add({ odbAddress: spaceAddress })
      }
      const syncSpace = async () => {
        // TODO - this logic isn't completely sound yet. Now it will just
        // always resolve after three seconds. We need a way to get unsynced
        // entries for the given store from the pinning node.
        await this._store._sync()
        if (opts.onSyncDone) opts.onSyncDone()
      }
      syncSpace()
    }
  }

  async get (key) {
    return this._store.get(key)
  }

  async set (key, value) {
    return this._store.set(key, value)
  }

  async remove (key) {
    return this._store.remove(key)
  }
}

module.exports = Space
