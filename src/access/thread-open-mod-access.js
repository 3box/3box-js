'use strict'
const ensureAddress = require('orbit-db-access-controllers/src/utils/ensure-ac-address')
const EventEmitter = require('events').EventEmitter
const entryIPFS = require('ipfs-log/src/entry')
const ThreeID = require('../3id/index')

const type = 'thread-access'
const MODERATOR = 'MODERATOR'
const MEMBER = 'MEMBER'

class ThreadAccessController extends EventEmitter{
  constructor (orbitdb, ipfs, identity, rootMod, options) {
    super()
    this._orbitdb = orbitdb
    this._db = null
    this._options = options || {}
    this._ipfs = ipfs
    this._members = Boolean(options.members)
    this._rootMod = rootMod
    this._threadName = options.threadName
    this._identity = identity
  }

  static get type () { return type }

  // return addres of AC (in this case orbitdb address of AC)
  get address () {
    return this._db.address
  }

  async canAppend (entry, identityProvider) {
    const trueIfValidSig = async () => await identityProvider.verifyIdentity(entry.identity)

    const op = entry.payload.op
    const mods = this.capabilities['moderators']
    const members = this.capabilities['members']
    const isMod = mods.includes(entry.identity.id)
    const isMember = members.includes(entry.identity.id)

    if (op === 'ADD') {
      // Anyone can add entry if open thread
      if (!this._members) return await trueIfValidSig()
      // Not open thread, any member or mod can add to thread
      if (isMember || isMod) return await trueIfValidSig()
    }

    if (op === 'DEL') {
      const hash = entry.payload.value
      const delEntry = await entryIPFS.fromMultihash(this._ipfs, hash)

      // An id can delete their own entries
      if (delEntry.identity.id === entry.identity.id) return await trueIfValidSig()

      // Mods can't delete other mods entries
      if (mods.includes(delEntry.identity.id)) return false

      // Mods can delete any other entries
      if (isMod) return await trueIfValidSig()
    }

    return false
  }

  get capabilities () {
    if (!this._capabilities) this._updateCapabilites()
    return this._capabilities
  }

  _updateCapabilites () {
    let moderators = [], members = []
    if (this._db) {
      moderators.push(this._db.access._rootMod)
      Object.entries(this._db.index).forEach(entry => {
        const capability = entry[1].payload.value.capability
        const id = entry[1].payload.value.id
        if (capability === MODERATOR) moderators.push(id)
        if (capability === MEMBER) members.push(id)
      })
    }
    this._capabilities = {moderators, members}
    return this._capabilities
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
      identity: this._identity,
      accessController: {
        type: 'moderator-access',
        rootMod: this._rootMod,
        members: this._members
      },
      sync: true
    })

    this._db.events.on('ready', this._onUpdate.bind(this))
    this._db.events.on('write', this._onUpdate.bind(this))
    this._db.events.on('replicated', this._onUpdate.bind(this))

    await this._db.load()
  }

  async save () {
    return {
      address: this._db.address.toString()
    }
  }

  async grant (capability, id) {
    if (!this._db.access.isValidCapability(capability)) {
      throw new Error('Invalid capability to grant')
    }
    if (!ThreeID.isValid3ID(id)) {
      throw new Error('Invalid 3ID to grant')
    }
    await this._db.add({capability, id})
  }

  _onUpdate () {
    this._updateCapabilites()
    this.emit('updated')
  }

  /* Factory */
  static async create (orbitdb, options = {}) {
    if (!options.rootMod) throw new Error('Thread AC: rootMod required')
    const ac = new ThreadAccessController(orbitdb, orbitdb._ipfs, options.identity, options.rootMod, options)
    await ac.load(options.threadName)
    return ac
  }
}

module.exports = ThreadAccessController
