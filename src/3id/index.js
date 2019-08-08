const { HDNode } = require('ethers').utils
const didJWT = require('did-jwt')
const DidDocument = require('ipfs-did-document')
const IpfsMini = require('ipfs-mini')
const localstorage = require('store')
const Identities = require('orbit-db-identity-provider')
const { OdbIdentityProvider } = require('3box-orbitdb-plugins')
Identities.addIdentityProvider(OdbIdentityProvider)
const utils = require('../utils/index')
const Keyring = require('./keyring')
const config = require('../config.js')

const DID_METHOD_NAME = '3'
const STORAGE_KEY = 'serialized3id_'
const MUPORT_IPFS = { host: config.muport_ipfs_host, port: config.muport_ipfs_port, protocol: config.muport_ipfs_protocol}

class ThreeId {
  constructor (idWallet, ethereum, ipfs, opts = {}) {
    this.idWallet = idWallet
    this._ethereum = ethereum
    this._ipfs = ipfs
    this._muportIpfs = opts.muportIpfs || MUPORT_IPFS
    this._pubkeys = { spaces: {} }
  }

  async signJWT (payload, { use3ID, space, expiresIn } = {}) {
    let issuer = this.muportDID
    if (use3ID) {
      issuer = this.DID
    } else if (space) {
      issuer = this._subDIDs[space]
    }
    if (this.idWallet) {
      return this.idWallet.signClaim(payload, { DID: issuer, space, expiresIn })
    } else {
      const keyring = this._keyringBySpace(space)
      const settings = {
        signer: keyring.getJWTSigner(),
        issuer,
        expiresIn
      }
      return didJWT.createJWT(payload, settings)
    }
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
    if (this.idWallet) throw new Error('Can not serializeState of IdentityWallet')
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

  _initKeys (serializedState) {
    if (this.idWallet) throw new Error('Can not initKeys of IdentityWallet')
    this._keyrings = {}
    const state = JSON.parse(serializedState)
    // TODO remove toLowerCase() in future, should be sanitized elsewhere
    //      this forces existing state to correct state so that address <->
    //      rootstore relation holds
    this.managementAddress = state.managementAddress.toLowerCase()
    this._mainKeyring = new Keyring(state.seed)
    Object.keys(state.spaceSeeds).map(name => {
      this._keyrings[name] = new Keyring(state.spaceSeeds[name])
    })
    localstorage.set(STORAGE_KEY + this.managementAddress, this.serializeState())
  }

  async _initDID () {
    const muportPromise = this._initMuport()
    this._rootDID = await this._init3ID()
    let spaces
    if (this.idWallet) {
      spaces = Object.keys(this._pubkeys.spaces)
    } else {
      spaces = Object.keys(this._keyrings)
    }
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
    const pubkeys = await this.getPublicKeys(spaceName, true)
    if (!spaceName) {
      doc.addPublicKey('signingKey', 'Secp256k1VerificationKey2018', 'publicKeyHex', pubkeys.signingKey)
      doc.addPublicKey('encryptionKey', 'Curve25519EncryptionPublicKey', 'publicKeyBase64', pubkeys.asymEncryptionKey)
      doc.addPublicKey('managementKey', 'Secp256k1VerificationKey2018', 'ethereumAddress', pubkeys.managementKey)
      doc.addAuthentication('Secp256k1SignatureAuthentication2018', 'signingKey')
    } else {
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

  async _initMuport () {
    const keys = await this.getPublicKeys(null)
    const doc = createMuportDocument(keys.signingKey, keys.managementKey, keys.asymEncryptionKey)
    let docHash = (await this._ipfs.add(Buffer.from(JSON.stringify(doc))))[0].hash
    this._muportDID = 'did:muport:' + docHash
    this.muportFingerprint = utils.sha256Multihash(this.muportDID)
    const publishToInfura = async () => {
      const ipfsMini = new IpfsMini(this._muportIpfs)
      ipfsMini.addJSON(doc, (err, res) => {
        if (err) console.error(err)
      })
    }
    publishToInfura()
  }

  async getAddress () {
    if (this.idWallet) {
      return this.idWallet.getAddress()
    } else {
      return this.managementAddress
    }
  }

  async authenticate (spaces, opts = {}) {
    spaces = spaces || []
    if (this.idWallet) {
      const pubkeys = await this.idWallet.authenticate(spaces, opts)
      this._pubkeys.main = pubkeys.main
      this._pubkeys.spaces = Object.assign(this._pubkeys.spaces, pubkeys.spaces)
      if (!this.DID) {
        await this._initDID()
      } else {
        for (const space of spaces) {
          this._subDIDs[space] = await this._init3ID(space)
        }
      }
    } else {
      for (const space of spaces) {
        await this._initKeyringByName(space)
      }
    }
  }

  async isAuthenticated (spaces = []) {
    if (this.idWallet) {
      return this.idWallet.isAuthenticated(spaces)
    } else {
      return spaces
        .map(space => Boolean(this._keyrings[space]))
        .reduce((acc, val) => acc && val, true)
    }
  }

  async _initKeyringByName (name) {
    if (this.idWallet) throw new Error('Can not initKeyringByName of IdentityWallet')
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

  async getPublicKeys (space, uncompressed) {
    let pubkeys
    if (this.idWallet) {
      pubkeys = Object.assign({}, space ? this._pubkeys.spaces[space] : this._pubkeys.main)
      if (uncompressed) {
        pubkeys.signingKey = Keyring.uncompress(pubkeys.signingKey)
      }
    } else {
      pubkeys = this._keyringBySpace(space).getPublicKeys(uncompressed)
      pubkeys.managementKey = this.managementAddress
    }
    return pubkeys
  }

  async encrypt (message, space) {
    if (this.idWallet) {
      return this.idWallet.encrypt(message, space)
    } else {
      return this._keyringBySpace(space).symEncrypt(utils.pad(message))
    }
  }

  async decrypt (encObj, space) {
    if (this.idWallet) {
      return this.idWallet.decrypt(encObj, space)
    } else {
      return utils.unpad(this._keyringBySpace(space).symDecrypt(encObj.ciphertext, encObj.nonce))
    }
  }

  async hashDBKey (key, space) {
    if (this.idWallet) {
      return this.idWallet.hashDBKey(key, space)
    } else {
      const salt = this._keyringBySpace(space).getDBSalt()
      return utils.sha256Multihash(salt + key)
    }
  }

  _keyringBySpace (space) {
    return space ? this._keyrings[space] : this._mainKeyring
  }

  logout () {
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
    const threeId = new ThreeId(null, ethereum, ipfs, opts)
    threeId._initKeys(serialized3id)
    await threeId._initDID()
    return threeId
  }

  static async getIdFromIdentityWallet (idWallet, ipfs, opts = {}) {
    const threeId = new ThreeId(idWallet, null, ipfs, opts)
    return threeId
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
