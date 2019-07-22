import { throwIfNotEqualLenArrays } from '../utils'

const generateTimestamp = () => 1558954408 // don't really need a real timestamp here.

class KeyValueStore {
  constructor (orbitdb, name, ensureConnected, threeId) {
    this._orbitdb = orbitdb
    this._name = name
    this._ensureConnected = ensureConnected
    this._3id = threeId
    this._store = {}
  }
  async get (key, opts = {}) {
    this._requireLoad()
    const value = await this._db.get(key)

    if (value && opts.metadata) {
      return {
        value,
        timestamp: generateTimestamp()
      }
    }

    return value
  }

  async set (key, value) {
    this._requireLoad()
    this._db.set(key, value)
    return true
  }

  async setMultiple(keys, values) {
    this._requireLoad()
    throwIfNotEqualLenArrays(keys, values)
    try {
      keys.map((key, i) => this._db.set(key, values[i]))
    } catch (error) {
      throw new Error(error)
    }
  }

  async remove (key) {
    this._requireLoad()
    this._db.remove(key)
    return true
  }

  async _sync (numRemoteEntries) {
    return '/orbitdb/myodbaddr'
  }

  _load () {
    this._db = {
      all: () => {
        let allObj = {}
        Object.keys(this._store).map(key => allObj[key] = { timeStamp: 123, value: this._store[key] })
        return allObj
      },
      set: (k, v) => this._store[k] = v,
      get: (k) => this._store[k],
      remove: k => delete this._store[k]
    }
    return '/orbitdb/myodbaddr'
  }

  _requireLoad () {
    if (!this._db) throw new Error('_load must be called before interacting with the store')
  }

  async close () {
    this._requireLoad()
  }

  async all (opts = {}) {
    this._requireLoad()
    const entries = await this._db.all()
    let allSimple = {}
    Object.keys(entries).map(key => {
      const entry = entries[key]

      if (opts.metadata) {
        allSimple[key] = {
          value: entry.value,
          timestamp: generateTimestamp()
        }
      } else {
        allSimple[key] = entry.value
      }
    })

    return allSimple
  }

  async log () {
    // simple mock, order and del ops not retained
    const all = this._db.all()
    return Object.keys(all).map(key => ({'op': 'PUT', 'key': key, 'value': all[key].value, 'timeStamp': all[key].timeStamp}))
  }
}

module.exports = KeyValueStore
