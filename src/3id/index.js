const { HDNode } = require('ethers').utils
const MuPort = require('muport-core')
const didJWT = require('did-jwt')
const localstorage = require('store')
const utils = require('../utils/index')
const Keyring = require('./keyring')


class ThreeId {
  constructor (serializeState, ethereum, opts) {
    this._ethereum = ethereum
    this._consentCallback = opts.consentCallback
    this._init3id(serializeState)
  }

  async signJWT (payload) {
    const settings = {
      signer: this._mainKeyring.getJWTSigner(),
      issuer: this._muport.getDid()
    }
    return didJWT.createJWT(payload, settings)
  }

  getDid () {
    return this._muport.getDid()
  }

  serializeState () {
    return JSON.stringify({
      managementAddress: this.managementAddress,
      mnemonic: this._mainKeyring.mnemonic,
      muport: this._muport.serializeState()
    })
  }

  _init3id (serializeState) {
    const state = JSON.parse(serializeState)
    this.managementAddress = state.managementAddress
    this._mainKeyring = new Keyring(state.mnemonic)
    this._muport = new MuPort(state.muport)
    this.muportFingerprint = utils.sha256Multihash(this._muport.getDid())
  }

  getKeyringByName (name) {
    if (name.startsWith(this.muportFingerprint)) {
      return this._mainKeyring
    }
  }

  initKeyringByName (name) {
  }

  logout() {
    localstorage.remove('serialized3id_' + normalizedAddress)
  }

  static isLoggedIn (address) {
    return Boolean(localstorage.get('serialized3id_' + address.toLowerCase()))
  }

  static async getIdFromEthAddress (address, ethereum, opts = {}) {
    const normalizedAddress = address.toLowerCase()
    let serialized3id = localstorage.get('serialized3id_' + normalizedAddress)
    if (serialized3id) {
      if (opts.consentCallback) opts.consentCallback(false)
    } else {
      const sig = await utils.openBoxConsent(normalizedAddress, ethereum)
      if (opts.consentCallback) opts.consentCallback(true)
      const entropy = '0x' + utils.sha256(sig.slice(2))
      console.log(HDNode)
      const mnemonic = HDNode.entropyToMnemonic(entropy)
      const muport = await MuPort.newIdentity(null, null, {
        externalMgmtKey: normalizedAddress,
        mnemonic
      })
      serialized3id = JSON.stringify({
        managementAddress: address,
        mnemonic,
        muport: muport.serializeState()
      })
      localstorage.set('serialized3id_' + normalizedAddress, serialized3id)
    }
    return new ThreeId(serialized3id, ethereum, opts)
  }
}

module.exports = ThreeId
