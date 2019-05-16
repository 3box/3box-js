// 'use strict'
const { io } = require('orbit-db-access-controllers/src/utils')
const AccessController = require('orbit-db-access-controllers/src/access-controller-interface')
const type = 'moderator-access'

class ModeratorAccessController {
  constructor (ipfs, options) {
    this._write = []
  }

  static get type () { return type }

  async canAppend (entry, identityProvider) {
    const mod = entry.identity.id
    const modAddId = entry.payload.value

    // Can write to moderator list store if in prior entry id was given permission (added to list)
    if (this._write.length === 0 || this._write.includes(mod) ) {
      this._write.push(modAddId)
      return true
    }

    return false
  }

  async load (address) {
    
  }


  async save () {
    return { address: 'moderator-access' }
  }

  static async create (orbitdb, options = {}) {
    return new ModeratorAccessController()
  }
}

module.exports = ModeratorAccessController
