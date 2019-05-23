const io = require('orbit-db-io')
const Buffer = require('safe-buffer/').Buffer
//const AccessController = require('./access-controller-interface')
const resolve = require('did-resolver').default
const type = 'legacy-ipfs-3box'

const publicKeyFromDID = async did => {
  // TODO - this should look at authentication keys and get publicKey from that
  const doc = await resolve(did)
  return doc.publicKey.find(entry => {
    const id = entry.id.split('#')
    return id[0] === doc.id &&
      (id[1] === 'subSigningKey' || id[1] === 'signingKey')
  }).publicKeyHex
}

class LegacyIPFS3BoxAccessController {
  constructor (ipfs, options) {
    //super()
    this._ipfs = ipfs
    this._write = Array.from(options.write || [])
  }

  // Returns the type of the access controller
  static get type () { return type }

  // Return a Set of keys that have `access` capability
  get write () {
    return this._write
  }

  async canAppend (entry, identityProvider) {
    // Allow if access list contain the writer's publicKey or is '*'
    const publicKey = entry.v === 0 ? entry.key : await publicKeyFromDID(entry.identity.id)
    if (this.write.includes(publicKey) ||
      this.write.includes('*')) {
      return true
    }
    return false
  }

  async load (address) {
    // Transform '/ipfs/QmPFtHi3cmfZerxtH9ySLdzpg1yFhocYDZgEZywdUXHxFU'
    // to 'QmPFtHi3cmfZerxtH9ySLdzpg1yFhocYDZgEZywdUXHxFU'
    if (address.indexOf('/ipfs') === 0) { address = address.split('/')[2] }

    try {
      const access = await io.read(this._ipfs, address)
      this._write = access.write
    } catch (e) {
      console.log('LegacyIPFS3BoxAccessController.load ERROR:', e)
    }
  }

  async save (options) {
    let cid
    const access = { admin: [], write: this.write, read: [] }
    try {
      cid = await io.write(this._ipfs, 'raw', Buffer.from(JSON.stringify(access, null, 2)), { format: 'dag-pb'})

    } catch (e) {
      console.log('LegacyIPFS3BoxAccessController.save ERROR:', e)
    }
    // return the manifest data
    return { address: cid, skipManifest: true }
  }

  static async create (orbitdb, options = {}) {
    options = { ...options, ...{ write: options.write || [orbitdb.identity.publicKey] } }
    return new LegacyIPFS3BoxAccessController(orbitdb._ipfs, options)
  }
}

module.exports = LegacyIPFS3BoxAccessController
