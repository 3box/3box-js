// 'use strict'
const AccessController = require('orbit-db-access-controllers/src/access-controller-interface')
const type = 'moderator-access'

const moderator = 'moderator'
const member = 'member'

class ModeratorAccessController {
  constructor (options) {
    this._capabilityType = {}
    this._capabilityType[moderator] = moderator
    this._write = []     // Allowed to add other mods or members
    this._rootMod =  options.rootMod || "*"
    this._write.push(this._rootMod)
    this._members = options.members
    if (this._members) this._capabilityType[member] = member
  }

  static get type () { return type }

  isMod(id) {
    this._write.includes(id)
  }

  isValidCapability (capability) {
    Object.entries(this._capabilityType).map(e => e[1]).includes(capability)
  }

  async canAppend (entry, identityProvider) {
    const entryID = entry.identity.id
    const capability = entry.payload.value.capability
    const isMod = this.isMod(entryID)
    const noMods = this._write.includes('*')
    const validCapability = isValidCapability(capability)

    // TODO need to still validate sigs with identity provider, extend from other, or implement here

    if ((noMods || isMod) && validCapability) {
      if (capability === this._capabilityType.moderator) this._write.push(modAddId)
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
    return new ModeratorAccessController(options)
  }
}

module.exports = ModeratorAccessController
