'use strict'

const AccessController = require('orbit-db-access-controllers/src/access-controller-interface')
const ensureAddress = require('orbit-db-access-controllers/src/utils/ensure-ac-address')
const entryIPFS = require('ipfs-log/src/entry')

const type = 'thread-access'

// TODO need extend access controller interface?
class ThreadAccessController {
  constructor (orbitdb, ipfs, options) {
    // super()
    this._orbitdb = orbitdb
    this._db = null
    this._options = options || {}
    this._ipfs = ipfs
    this._members = options.members
    this._rootMod = options.rootMod
    this._threadName = options.threadName
  }

  // Returns the type of the access controller
  static get type () { return type }

  // Returns the address of the OrbitDB used as the AC
  get address () {
    return this._db.address
  }

  async canAppend (entry, identityProvider) {
    const trueIfValidSig = () => identityProvider.verifyIdentity(entry.identity)

    const op = entry.payload.op
    const mods = this.capabilities['mod']
    const members = this.capabilities['member']
    const isMod = members.includes(entry.identity.id)
    const isMember = members.includes(entry.identity.id)

    if (op === 'ADD') {
      // Anyone can add entry if open thread
      if (!this._members) return trueIfValidSig()
      // Not open thread, any member or mod can add to thread
      if (isMember || isMod) return trueIfValidSig()
    }

    if (op === 'DEL') {
      const hash = entry.payload.value
      const delEntry = await entryIPFS.fromMultihash(this._ipfs, hash)

      // An id can delete their own entries
      if (delEntry.identity.id === entry.identity.id) return trueIfValidSig()

      // Mods can't delete other mods entries
      if (mods.includes(delEntry.identity.id)) return false

      // Mods can delete any other entries
      if (isMod) return trueIfValidSig()
    }

    return false
  }

  get capabilities () {
    // TODO dont do this for every entry, save result, update on db change
    if (this._db) {
      let mod = []
      let member = []
      Object.entries(this._db.index).forEach(entry => {
        const capability = entry[1].payload.value.capability
        const id = entry[1].payload.value.id
        if (capability === 'mod') mod.push(id)
        if (capability === 'member') member.push(id)
      })
      return {mod, member}
    }
    return {}
  }

  get (capability) {
    return this.capabilities[capability] || []
  }

  async close () {
    await this._db.close()
  }

  async load (address) {
    if (this._db) { await this._db.close() }

    this._db = await this._orbitdb.feed(ensureAddress(address), {
      accessController: {
        type: 'moderator-access',
        rootMod: this._rootMod || '*',
        members: this._members
      },
      sync: true
    })

    console.log(this._db.address.toString())

    this._db.events.on('ready', this._onUpdate.bind(this))
    this._db.events.on('write', this._onUpdate.bind(this))
    this._db.events.on('replicated', this._onUpdate.bind(this))
    // TODO Update as possible
    await this._db.load()
  }

  async save () {
    // return the manifest data
    return {
      address: this._db.address.toString()
    }
  }

  async grant (capability, id) {
    // TODO  sanitize key
    // handle error if can't grant?
    await this._db.add({capability, id})
  }

  /* Private methods */
  _onUpdate () {
    // this.emit('updated')
    // TODO add back
  }

  /* Factory */
  static async create (orbitdb, options = {}) {
    const ac = new ThreadAccessController(orbitdb, orbitdb._ipfs, options)
    console.log(options)
    // Thread address here
    // console.log(options.address)
    await ac.load(options.threadName)
    return ac
  }
}

module.exports = ThreadAccessController
