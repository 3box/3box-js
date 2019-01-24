const KeyValueStore = require('./keyValueStore')

class ProfileStore extends KeyValueStore {
  constructor (orbitdb, name, linkProfile, ensureConnected, _3id) {
    super(orbitdb, name, ensureConnected, _3id)
    this._linkProfile = linkProfile
  }

  async set (key, value) {
    this._linkProfile()
    return super.set(key, value)
  }
}

module.exports = ProfileStore
