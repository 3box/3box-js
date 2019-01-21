const KeyValueStore = require('./keyValueStore')

class Spaces {
  constructor (threeId, orbitdb, rootStore, ensureConnected) {
    this._3id = threeId
    this._orbitdb = orbitdb
    this._rootStore = rootStore
    this._ensureConnected = ensureConnected
  }

  async open (name, opts = {}) {
    if (this[name]) throw new Error(`${name} is not an allowed name`)

    const consentNeeded = await this._3id.initKeyringByName(name)
    if (opts.consentCallback) opts.consentCallback(consentNeeded, name)
    this[name] = new KeyValueStore(this._orbitdb, `3box.space.${name}`, this._ensureConnected, this._3id)
    const spaceAddress = this[name]._load()

    const entries = await this._rootStore.iterator({ limit: -1 }).collect()
    if (!entries.find(entry => entry.payload.value.odbAddress.split('.')[2] === name)) {
      this._rootStore.add({ odbAddress: spaceAddress })
    }
    const syncSpace = async () => {
      await this[name]._sync()
      if (opts.onSyncDone) opts.onSyncDone()
    }
    syncSpace()
    return this[name]
  }
}

module.exports = Spaces
