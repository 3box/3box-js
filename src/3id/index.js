const { HDNode } = require('ethers').utils
const didJWT = require('did-jwt')
const DidDocument = require('ipfs-did-document')
const IpfsMini = require('ipfs-mini')
const localstorage = require('store')
const Identities = require('orbit-db-identity-provider')
const { OdbIdentityProvider } = require('3box-orbitdb-plugins')
Identities.addIdentityProvider(OdbIdentityProvider)
const registerResolver = require('3id-resolver')
const utils = require('../utils/index')
const Keyring = require('./keyring')
const config = require('../config.js')

const DID_METHOD_NAME = '3'
const STORAGE_KEY = 'serialized3id_'
const MUPORT_IPFS = { host: config.muport_ipfs_host, port: config.muport_ipfs_port, protocol: config.muport_ipfs_protocol}

class ThreeId {
  constructor (serializeState, ethereum, ipfs, opts) {
    this._ethereum = ethereum
    this._ipfs = ipfs
    this._keyrings = {}
    this._initKeys(serializeState, opts)
    registerResolver(ipfs)
    localstorage.set(STORAGE_KEY + this.managementAddress, this.serializeState())
  }

  async signJWT (payload, { use3ID, space, expiresIn } = {}) {
    const keyring = space ? this._keyrings[space] : this._mainKeyring
    let issuer = this.muportDID
    if (use3ID) {
      issuer = this.DID
    } else if (space) {
      issuer = this._subDIDs[space]
    }
    const settings = {
      signer: keyring.getJWTSigner(),
      issuer,
      expiresIn
    }
    return didJWT.createJWT(payload, settings)
  }

  get DID () {
    return this._rootDID
  }

  get muportDID () {
    return this._muportDID
  }

  getSubDID (space) {
    return this._subDIDs[space]
  }

  async getOdbId (space) {
    return Identities.createIdentity({
      type: '3ID',
      threeId: this,
      space
    })
  }

  serializeState () {
    let stateObj = {
      managementAddress: this.managementAddress,
      seed: this._mainKeyring.serialize(),
      spaceSeeds: {},
    }
    Object.keys(this._keyrings).map(name => {
      stateObj.spaceSeeds[name] = this._keyrings[name].serialize()
    })
    return JSON.stringify(stateObj)
  }

  _initKeys (serializeState) {
    const state = JSON.parse(serializeState)
    // TODO remove toLowerCase() in future, should be sanitized elsewhere
    //      this forces existing state to correct state so that address <->
    //      rootstore relation holds
    this.managementAddress = state.managementAddress.toLowerCase()
    this._mainKeyring = new Keyring(state.seed)
    Object.keys(state.spaceSeeds).map(name => {
      this._keyrings[name] = new Keyring(state.spaceSeeds[name])
    })
  }

  async _initDID (muportIpfs) {
    const muportPromise = this._initMuport(muportIpfs)
    this._rootDID = await this._init3ID()
    const spaces = Object.keys(this._keyrings)
    const subDIDs = await Promise.all(
      spaces.map(space => {
        return this._init3ID(space)
      })
    )
    this._subDIDs = {}
    spaces.map((space, i) => {
      this._subDIDs[space] = subDIDs[i]
    })
    await muportPromise
  }

  async _init3ID (spaceName) {
    const doc = new DidDocument(this._ipfs, DID_METHOD_NAME)
    if (!spaceName) {
      const pubkeys = this._mainKeyring.getPublicKeys(true)
      doc.addPublicKey('signingKey', 'Secp256k1VerificationKey2018', 'publicKeyHex', pubkeys.signingKey)
      doc.addPublicKey('encryptionKey', 'Curve25519EncryptionPublicKey', 'publicKeyBase64', pubkeys.asymEncryptionKey)
      doc.addPublicKey('managementKey', 'Secp256k1VerificationKey2018', 'ethereumAddress', this.managementAddress)
      doc.addAuthentication('Secp256k1SignatureAuthentication2018', 'signingKey')
    } else {
      const pubkeys = this._keyrings[spaceName].getPublicKeys(true)
      doc.addPublicKey('subSigningKey', 'Secp256k1VerificationKey2018', 'publicKeyHex', pubkeys.signingKey)
      doc.addPublicKey('subEncryptionKey', 'Curve25519EncryptionPublicKey', 'publicKeyBase64', pubkeys.asymEncryptionKey)
      doc.addAuthentication('Secp256k1SignatureAuthentication2018', 'subSigningKey')
      doc.addCustomProperty('space', spaceName)
      doc.addCustomProperty('root', this.DID)
      const payload = {
        subSigningKey: pubkeys.signingKey,
        subEncryptionKey: pubkeys.asymEncryptionKey,
        space: spaceName,
        iat: null
      }
      const signature = (await this.signJWT(payload, { use3ID: true })).split('.')[2]
      doc.addCustomProperty('proof', { alg: 'ES256K', signature })
    }
    await doc.commit({ noTimestamp: true })
    return doc.DID
  }

  async _initMuport (muportIpfs) {
    let keys = this._mainKeyring.getPublicKeys()
    const doc = createMuportDocument(keys.signingKey, this.managementAddress, keys.asymEncryptionKey)
    let docHash = (await this._ipfs.add(Buffer.from(JSON.stringify(doc))))[0].hash
    this._muportDID = 'did:muport:' + docHash
    this.muportFingerprint = utils.sha256Multihash(this.muportDID)
    const publishToInfura = async () => {
      const ipfsMini = new IpfsMini(muportIpfs)
      ipfsMini.addJSON(doc, (err, res) => {
        if (err) console.error(err)
      })
    }
    publishToInfura()
  }

  getKeyringBySpaceName (name) {
    const split = name.split('.')
    if (split[0] === this.muportFingerprint) {
      return this._mainKeyring
    } else {
      return this._keyrings[split[2]]
    }
  }

  async initKeyringByName (name) {
    if (!this._keyrings[name]) {
      const sig = await utils.openSpaceConsent(this.managementAddress, this._ethereum, name)
      const entropy = '0x' + utils.sha256(sig.slice(2))
      const seed = HDNode.mnemonicToSeed(HDNode.entropyToMnemonic(entropy))
      this._keyrings[name] = new Keyring(seed)
      this._subDIDs[name] = await this._init3ID(name)
      localstorage.set(STORAGE_KEY + this.managementAddress, this.serializeState())
      return true
    } else {
      return false
    }
  }

  logout() {
    localstorage.remove(STORAGE_KEY + this.managementAddress)
  }

  static isLoggedIn (address) {
    return Boolean(localstorage.get(STORAGE_KEY + address.toLowerCase()))
  }

  static async getIdFromEthAddress (address, ethereum, ipfs, opts = {}) {
    const normalizedAddress = address.toLowerCase()
    let serialized3id = localstorage.get(STORAGE_KEY + normalizedAddress)
    if (serialized3id) {
      if (opts.consentCallback) opts.consentCallback(false)
    } else {
      let sig
      if (opts.contentSignature) {
        sig = opts.contentSignature
      } else {
        sig = await utils.openBoxConsent(normalizedAddress, ethereum)
      }
      if (opts.consentCallback) opts.consentCallback(true)
      const entropy = '0x' + utils.sha256(sig.slice(2))
      const mnemonic = HDNode.entropyToMnemonic(entropy)
      const seed = HDNode.mnemonicToSeed(mnemonic)
      serialized3id = JSON.stringify({
        managementAddress: normalizedAddress,
        seed,
        spaceSeeds: {}
      })
    }
    const _3id = new ThreeId(serialized3id, ethereum, ipfs, opts)
    await _3id._initDID(opts.muportIpfs || MUPORT_IPFS)
    return _3id
  }
}

const createMuportDocument = (signingKey, managementKey, asymEncryptionKey) => {
  return {
    version: 1,
    signingKey,
    managementKey,
    asymEncryptionKey
  }
}

module.exports = ThreeId
