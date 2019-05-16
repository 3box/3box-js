'use strict'

const pMapSeries = require('p-map-series')
const AccessController = require('orbit-db-access-controllers/src/access-controller-interface')
const ensureAddress = require('orbit-db-access-controllers/src/utils/ensure-ac-address')
const entryIPFS = require('ipfs-log/src/entry')

const type = 'thread-access'

class ThreadAccessController {
  constructor (orbitdb, ipfs, options) {
    // super()
    this._orbitdb = orbitdb
    this._db = null
    this._options = options || {}
    this._ipfs = ipfs
  }

  // Returns the type of the access controller
  static get type () { return type }

  // Returns the address of the OrbitDB used as the AC
  get address () {
    return this._db.address
  }

  async canAppend (entry, identityProvider) {
    const op = entry.payload.op
    const mods = this.capabilities['mod']

    // Anyone can add a message
    if (op === 'ADD') {
      return true
    }

    if (op === 'DEL') {
      const hash = entry.payload.value
      const delEntry = await entryIPFS.fromMultihash(this._ipfs, hash)

      // An id can delete their own entries
      if (delEntry.identity.id === entry.identity.id) {
        return true
      }

      // Mods can't delete other mods entries
      if (mods.includes(delEntry.identity.id)) {
        return false
      }

      // Mods can delete any other entries
      if (mods.includes(entry.identity.id)) {
        return true
      }
    }


    return false
  }

  get capabilities () {
    if (this._db) {
      let capabilities = {}
      const mods = Object.entries(this._db.index).map(entry => entry[1].payload.value)
      capabilities['mod'] = mods
      return capabilities
    }
    return {}
  }

  get (capability) {
    return this.capabilities[capability] || new Set([])
  }

  async close () {
    await this._db.close()
  }

  async load (address) {
    if (this._db) { await this._db.close() }
    // Force '<address>/_access' naming for the database
    this._db = await this._orbitdb.feed(ensureAddress(address), {
      // Use moderator access controller
      accessController: {
        type: 'moderator-access',
      },
      sync: true
    })

    //TODO Move somehwere else. but try to add id opening, in case they are first to open this thread
    await this._db.add(this._db.identity.id)

    this._db.events.on('ready', this._onUpdate.bind(this))
    this._db.events.on('write', this._onUpdate.bind(this))
    this._db.events.on('replicated', this._onUpdate.bind(this))

    await this._db.load()
  }

  async save () {
    // return the manifest data
    return {
      address: this._db.address.toString()
    }
  }

  async grant (capability, key) {
    // may use capability after for member vs mod
    await this._db.add(key)
  }

  /* Private methods */
  _onUpdate () {
    // this.emit('updated')
    // TODO add back
  }

  /* Factory */
  static async create (orbitdb, options = {}) {
    const ac = new ThreadAccessController(orbitdb, orbitdb._ipfs, options)
    // Thread address here
    await ac.load(options.address || 'thread-access-controller')
    return ac
  }
}

module.exports = ThreadAccessController
