class KeyValueStore {
  constructor (orbitdb, name, ensureConnected, threeId) {
    this._orbitdb = orbitdb
    this._name = name
    this._ensureConnected = ensureConnected
    this._3id = threeId
    this._store = {}
  }
  async get (key) {
    this._requireLoad()
    return this._db.get(key)
  }

  async set (key, value) {
    this._requireLoad()
    this._db.set(key, value)
    return true
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

  async all () {
    this._requireLoad()
    const entries = await this._db.all()
    let allSimple = {}
    Object.keys(entries).map(key => { allSimple[key] = entries[key].value })
    return allSimple
  }

  get log () {
    // simple mock, order and del ops not retained
    const all = this._db.all()
    return   Object.keys(all).map(key => ({'op': 'PUT', 'key': key, 'value': all[key].value, 'timeStamp': all[key].timeStamp}))
  }
}

export default KeyValueStore
