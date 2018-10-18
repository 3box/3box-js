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
    if (!this._db) throw new Error('_init must be called before interacting with the store')
    const entries = await this._db.all()
    let allSimple = {}
    Object.keys(entries).map(key => { allSimple[key] = entries[key].value })
    return allSimple
  }
}

module.exports = ProfileStore
