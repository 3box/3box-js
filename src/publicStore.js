const KeyValueStore = require('./keyValueStore')
const { throwIfUndefined, throwIfNotEqualLenArrays } = require('./utils/index')

class ProfileStore extends KeyValueStore {
  async set (key, value) {
    throwIfUndefined(key, 'key')
    return super.set(key, value)
  }

  async setMultiple (keys, values) {
    throwIfNotEqualLenArrays(keys, values)
    return super.setMultiple(keys, values)
  }
}

module.exports = ProfileStore
