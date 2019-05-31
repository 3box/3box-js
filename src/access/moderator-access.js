// 'use strict'
const type = 'moderator-access'

const MODERATOR = 'MODERATOR'
const MEMBER = 'MEMBER'

class ModeratorAccessController {
  constructor (rootMod, options) {
    this._capabilityTypes = [MODERATOR]
    this._write = []     // Allowed to add other mods or members
    this._rootMod = rootMod
    this._write.push(this._rootMod)
    this._members = Boolean(options.members)
    if (this._members) this._capabilityTypes.push(MEMBER)
  }

  static get type () { return type }

  isMod(id) {
    return this._write.includes(id)
  }

  isValidCapability (capability) {
    return this._capabilityTypes.includes(capability)
  }

  get rootModerator () {
    return this._rootMod
  }

  async canAppend (entry, identityProvider) {
    const entryID = entry.identity.id
    const capability = entry.payload.value.capability
    const idAdd = entry.payload.value.id
    const isMod = this.isMod(entryID)
    const validCapability = this.isValidCapability(capability)
    const validSig = async () => identityProvider.verifyIdentity(entry.identity)
    if (isMod && validCapability && (await validSig())) {
      if (capability === MODERATOR) this._write.push(idAdd)
      return true
    }

    return false
  }

  async load (address) {
    const addList = address.split('/')
    const suffix = addList.pop()
    this._members = suffix === 'members'
    const mod = suffix.includes('mod') ? suffix : addList.pop()
    this._rootMod = mod.split('_')[1]
  }

  async save () {
    // TODO if entire obj saved in manfest, can just pass our own fields
    let address = `${type}/mod_${this._rootMod}`
    address += this._members ? '/members' : ''
    return { address }
  }

  static async create (orbitdb, options = {}) {
    if (!options.rootMod) throw new Error('Moderator AC: rootMod required')
    return new ModeratorAccessController(options.rootMod, options)
  }
}

module.exports = ModeratorAccessController
