const KeyValueStore = require('./keyValueStore')

class ProfileStore extends KeyValueStore {
  constructor (orbitdb, name, linkProfile) {
    super(orbitdb, name)
    this._linkProfile = linkProfile
  }

  async set (key, value) {
    this._linkProfile()
    return super.set(key, value)
  }

  async all () {
    if (!this._db) throw new Error('_sync must be called before interacting with the store')
    return this._db.all()
  }
}

module.exports = ProfileStore
