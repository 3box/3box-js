const KeyValueStore = require('./keyValueStore')
const { throwIfUndefined, throwIfNotEqualLenArrays } = require('./utils/index')

class ProfileStore extends KeyValueStore {
  constructor (orbitdb, name, linkProfile, ensureConnected, _3id) {
    super(orbitdb, name, ensureConnected, _3id)
    this._linkProfile = linkProfile
  }

  async set (key, value, opts = {}) {
    throwIfUndefined(key, 'key')
    // if this is the noLink call we shouldn't call _linkProfile.
    if (!opts.noLink) await this._linkProfile()
    return super.set(key, value)
  }

  async setMultiple (keys, values) {
    throwIfNotEqualLenArrays(keys, values)
    await this._linkProfile()
    return super.setMultiple(keys, values)
  }
}

module.exports = ProfileStore
