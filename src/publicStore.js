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

  async all () {
    super._requireLoad()
    const entries = await this._db.all()
    let allSimple = {}
    Object.keys(entries).map(key => { allSimple[key] = entries[key].value })
    return allSimple
  }
}

module.exports = ProfileStore
