const MuPort = require('muport-core')
const bip39 = require('bip39')
const store = require('store')
const ipfsAPI = require('IpfsApi')

const ProfileStore = require('./profileStore')
const PrivateStore = require('./privateStore')
const utils = require('./utils')


class ThreeBox {

  /**
   * Instantiates a threeBox
   *
   * @param     {MuPort}        muportDID                   A MuPort DID instance
   * @param     {Web3Provider}  web3provider                A Web3 provider
   * @return    {ThreeBox}                                  self
   */
  constructor (muportDID, opts = {}) {
    this.muportDID = muportDID
    this.rootHash = null
    if (store.get(this.muportDID.getDid())) {
      this.localCache = JSON.parse(store.get(this.muportDID.getDid()))
    } else {
      this.localCache = {}
    }
    this.ipfs = opts.ipfs || new ipfsAPI('ipfs.infura.io', '5001', {protocol: 'https'})

    /**
     * @property {ProfileStore} profileStore        access the profile store of the users threeBox
     */
    this.profileStore = new ProfileStore(this.ipfs, this._publishUpdate.bind(this, 'profile'))
    /**
     * @property {PrivateStore} privateStore        access the private store of the users threeBox
     */
    this.privateStore = new PrivateStore(muportDID, this.ipfs, this._publishUpdate.bind(this, 'datastore'))
  }

  /**
   * Get the public profile of the given address
   *
   * @param     {String}    address                 an ethereum address
   * @return    {Object}                         the threeBox instance for the given address
   */
  static async getProfile (address) {
    // TODO - get the hash associated with the address from the root-hash-tracker and get the profile object
    // should be simple getting: <multi-hash>/profile from ipfs.
    return {}
  }

  /**
   * Get the public activity of the given address
   *
   * @param     {String}    address                 an ethereum address
   * @return    {Object}                         the threeBox instance for the given address
   */
  static async getActivity (address) {
    return {}
  }

  /**
   * Opens the user space associated with the given address
   *
   * @param     {String}    address                 an ethereum address
   * @return    {ThreeBox}                         the threeBox instance for the given address
   */
  static async openBox (address, web3provider, opts = {}) {
    console.log('user', address)
    let muportDID
    let serializedMuDID = store.get('serializedMuDID_' + address)
    if (serializedMuDID) {
      muportDID = new MuPort(serializedMuDID)
    } else {
      const entropy = (await utils.openBoxConsent(address, web3provider)).slice(2, 34)
      const mnemonic = bip39.entropyToMnemonic(entropy)
      muportDID = await MuPort.newIdentity(null, null, {
        externalMgmtKey: address,
        mnemonic
      })
      store.set('serializedMuDID_' + address, muportDID.serializeState())
    }
    console.log('3box opened with', muportDID.getDid())
    let threeBox = new ThreeBox(muportDID, web3provider)
    await threeBox._sync()
    return threeBox
  }

  async _sync () {
    // sync hash with root-hash-tracker and sync stores
    const rootObject = // sync root ipld object
    this.profileStore._sync(rootObject.profile)
    this.privateStore._sync(rootObject.datastore)
  }

  async _publishUpdate (store, hash) {
    // TODO - generate root ipld object publish its hash to RHT (root-hash-tracker)
  }

  async _linkProfile () {
    const address = // TODO get address from muportDID
    const consentSignature = await utils.getLinkConsent(address, this.muportDID.getDid(), this.web3provider)

    // TODO - send consentSignature to root-hash-tracker to link profile with ethereum address
  }

  _clearCache () {
    store.remove('serializedMuDID_' + this.muportDID.getDidDocument().managementKey)
  }

  //async postEvent (payload) {
    //const encrypted = this.muportDID.symEncrypt(JSON.stringify(payload))
    //const event_token = await this.muportDID.signJWT({
      //previous: this.previous,
      //event: encrypted.ciphertext + '.' + encrypted.nonce
    //})
    //this.previous = (await utils.httpRequest(CALEUCHE_URL, 'POST', {event_token})).data.id
    //console.log('added event with id', this.previous)
  //}
}

module.exports = ThreeBox
