// 'use strict'
const { io } = require('orbit-db-access-controllers/src/utils')
const AccessController = require('orbit-db-access-controllers/src/access-controller-interface')
const type = 'moderator-access'

class ModeratorAccessController {
  constructor (ipfs, options) {
    // Allowed to add other mods or members
    this._write = []
    this._rootMod =  options.rootMod || "*"
  }

  static get type () { return type }

  async canAppend (entry, identityProvider) {
    const entryID = entry.identity.id
    const isMod = this._write.includes(entryID)

    if (this._write.length === 0 || isMod ) {
      const capability = entry.payload.value.capability
      if (capability === 'mod') this._write.push(modAddId)
      return true
    }

    return false
  }

  async load (address) {

  }


  async save () {
    // self reference store it is used on, doesn't need to be unique
    return { address: 'moderator-access' }
  }

  static async create (orbitdb, options = {}) {
    return new ModeratorAccessController(options)
  }
}

module.exports = ModeratorAccessController
