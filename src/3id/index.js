const { HDNode } = require('ethers').utils
const MuPort = require('muport-core')
const didJWT = require('did-jwt')
const localstorage = require('store')
const utils = require('../utils/index')
const Keyring = require('./keyring')

const STORAGE_KEY = 'serialized3id_'

class ThreeId {
  constructor (serializeState, ethereum, opts) {
    this._ethereum = ethereum
    this._keyrings = {}
    this._init3id(serializeState)
    localstorage.set(STORAGE_KEY + this.managementAddress, this.serializeState())
  }

  async signJWT (payload) {
    const settings = {
      signer: this._mainKeyring.getJWTSigner(),
      //issuer: this.getDid()
      issuer: this._muport.getDid()
    }
    return didJWT.createJWT(payload, settings)
  }

  getDid () {
    return this._muport.getDid()
  }

  serializeState () {
    let stateObj = {
      managementAddress: this.managementAddress,
      mnemonic: this._mainKeyring.mnemonic,
      spaceMnemonics: {},
      muport: this._muport.serializeState()
    }
    Object.keys(this._keyrings).map(name => {
      stateObj.spaceMnemonics[name] = this._keyrings[name].mnemonic
    })
    return JSON.stringify(stateObj)
  }

  _init3id (serializeState) {
    const state = JSON.parse(serializeState)
    this.managementAddress = state.managementAddress
    this._mainKeyring = new Keyring(state.mnemonic)
    this._muport = new MuPort(state.muport)
    Object.keys(state.spaceMnemonics).map(name => {
      this._keyrings[name] = new Keyring(state.spaceMnemonics[name])
    })
    this.muportFingerprint = utils.sha256Multihash(this._muport.getDid())
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
      const mnemonic = HDNode.entropyToMnemonic(entropy)
      this._keyrings[name] = new Keyring(mnemonic)
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

  static async getIdFromEthAddress (address, ethereum, opts = {}) {
    const normalizedAddress = address.toLowerCase()
    let serialized3id = localstorage.get(STORAGE_KEY + normalizedAddress)
    if (serialized3id) {
      if (opts.consentCallback) opts.consentCallback(false)
    } else {
      const sig = await utils.openBoxConsent(normalizedAddress, ethereum)
      if (opts.consentCallback) opts.consentCallback(true)
      const entropy = '0x' + utils.sha256(sig.slice(2))
      const mnemonic = HDNode.entropyToMnemonic(entropy)
      const muport = await MuPort.newIdentity(null, null, {
        externalMgmtKey: normalizedAddress,
        mnemonic
      })
      serialized3id = JSON.stringify({
        managementAddress: address,
        mnemonic,
        spaceMnemonics: {},
        muport: muport.serializeState()
      })
    }
    return new ThreeId(serialized3id, ethereum, opts)
  }
}

module.exports = ThreeId
