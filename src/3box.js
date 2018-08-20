const MuPort = require('muport-core')
const bip39 = require('bip39')
const store = require('store')
const XMLHttpRequest = (typeof window !== 'undefined') ? window.XMLHttpRequest : require('xmlhttprequest').XMLHttpRequest


class ThreeBox {

  /**
   * Instantiates a threeBox
   *
   * @param     {MuPort}    muportDID                   A MuPort DID instance
   * @return    {ThreeBox}                         self
   */
  constructor (muportDID, opts = {}) {
    this.muportDID = muportDID
    this.rootHash = null
    if (store.get(this.muportDID.getDid())) {
      this.localCache = JSON.parse(store.get(this.muportDID.getDid()))
    } else {
      this.localCache = {}
    }

    /**
     * @property {ProfileStore} profileStore        access the profile store of the users threeBox
     */
    this.profileStore = new ProfileStore(muportDID, opts)
    /**
     * @property {PrivateStore} privateStore        access the private store of the users threeBox
     */
    this.privateStore = new PrivateStore(muportDID, opts)
  }

  /**
   * Get the public profile of the given address
   *
   * @param     {String}    address                 an ethereum address
   * @return    {Object}                         the threeBox instance for the given address
   */
  static async getProfile (address) {
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
  static async openBox (address) {
    console.log('user', address)
    let muportDID
    let serializedMuDID = store.get('serializedMuDID_' + address)
    if (serializedMuDID) {
      muportDID = new MuPort(serializedMuDID)
    } else {
      const entropy = (await authUser(address)).slice(2, 34)
      const mnemonic = bip39.entropyToMnemonic(entropy)
      muportDID = await MuPort.newIdentity(null, null, {
        externalMgmtKey: address,
        mnemonic
      })
      store.set('serializedMuDID_' + address, muportDID.serializeState())
    }
    console.log('3box opened with', muportDID.getDid())
    let threeBox = new ThreeBox(muportDID)
    await threeBox.sync()
    return threeBox
  }

  async sync () {
    // sync hash with root-hash-tracker and sync orbit-db
  }

  clearCache () {
    store.remove('serializedMuDID_' + this.muportDID.getDidDocument().managementKey)
  }

  //async postEvent (payload) {
    //const encrypted = this.muportDID.symEncrypt(JSON.stringify(payload))
    //const event_token = await this.muportDID.signJWT({
      //previous: this.previous,
      //event: encrypted.ciphertext + '.' + encrypted.nonce
    //})
    //this.previous = (await request(CALEUCHE_URL, 'POST', {event_token})).data.id
    //console.log('added event with id', this.previous)
  //}
}
module.exports = ThreeBox

class ProfileStore {
  /**
   * Instantiates a ProfileStore
   *
   * @param     {MuPort}    muportDID                   A MuPort DID instance
   * @return    {ProfileStore}                         self
   */
  constructor(muportDID, opts = {}) {
  }

  /**
   * Get the value of the given key
   *
   * @param     {String}    key                     the key
   * @return    {String}                            the value associated with the key
   */
  async get (key) {
    return 'item'
  }

  /**
   * Set a value for the given key
   *
   * @param     {String}    key                     the key
   * @param     {String}    value                   the value
   * @return    {Boolean}                           true if successful
   */
  async set (key, value) {
    return false
  }

  /**
   * Remove the value for the given key
   *
   * @param     {String}    key                     the key
   * @return    {Boolean}                           true if successful
   */
  async remove (key) {
    return false
  }
}

class PrivateStore {
  /**
   * Instantiates a PrivateStore
   *
   * @param     {MuPort}    muportDID                   A MuPort DID instance
   * @return    {PrivateStore}                         self
   */
  constructor(muportDID, opts = {}) {
  }

  /**
   * Get the value of the given key
   *
   * @param     {String}    key                     the key
   * @return    {String}                            the value associated with the key
   */
  async get (key) {
    return 'item'
  }

  /**
   * Set a value for the given key
   *
   * @param     {String}    key                     the key
   * @param     {String}    value                   the value
   * @return    {Boolean}                           true if successful
   */
  async set (key, value) {
    return false
  }

  /**
   * Remove the value for the given key
   *
   * @param     {String}    key                     the key
   * @return    {Boolean}                           true if successful
   */
  async remove (key) {
    return false
  }
}

function authUser (from) {
    var text = 'Open 3box' // TODO - put real consent text here
  var msg = '0x' + Buffer.from(text, 'utf8').toString('hex')
  var params = [msg, from]
  var method = 'personal_sign'
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      method,
      params,
      from,
    }, function (err, result) {
      if (err) reject(err)
      if (result.error) reject(result.error)
      resolve(result.result)
    })
  })
}

function request (url, method, payload) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.onreadystatechange = () => {
      if (request.readyState === 4 && request.timeout !== 1) {
        if (request.status !== 200) {
          console.log(request)
          reject(request.responseText)
        } else {
          try {
            resolve(JSON.parse(request.response))
          } catch (jsonError) {
            reject(`[threeBox] while parsing data: '${String(request.responseText)}', error: ${String(jsonError)}`)
          }
        }
      }
    }
    request.open(method, url)
    //request.setRequestHeader('accept', 'application/json')
    request.setRequestHeader('accept', '*/*')
    if (method === 'POST') {
      request.setRequestHeader('Content-Type', `application/json`)
      request.send(JSON.stringify(payload))
      //request.send(payload)
    } else {
      request.setRequestHeader('Authorization', `Bearer ${payload}`)
      request.send()
    }
  })
}
