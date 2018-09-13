const MuPort = require('muport-core')
const bip39 = require('bip39')
const localstorage = require('store')
const IpfsAPI = require('ipfs-api')
const DAGNode = require('ipld-dag-pb').DAGNode

const ProfileStore = require('./profileStore')
const PrivateStore = require('./privateStore')
const utils = require('./utils')

// TODO: Put production 3box-hash-server instance here ;)
const HASH_SERVER_URL = 'https://api.uport.space/hash-server'

class ThreeBox {
  /**
   * Please use the **openBox** to instantiate a ThreeBox
   */
  constructor (muportDID, web3provider, opts = {}) {
    this.muportDID = muportDID
    this.web3provider = web3provider
    this.ipfs = opts.ipfs || new IpfsAPI('ipfs.infura.io', '5001', { protocol: 'https' })
    this.hashServerUrl = opts.hashServer || HASH_SERVER_URL

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
   * @param     {Object}    opts                    Optional parameters
   * @param     {IPFS}      opts.ipfs               A custom ipfs instance
   * @return    {Object}                            a json object with the profile for the given address
   */
  static async getProfile (address, opts = {}) {
    let ipfs = opts.ipfs || new IpfsAPI('ipfs.infura.io', '5001', { protocol: 'https' })
    const hashServerUrl = opts.hashServer || HASH_SERVER_URL
    try {
      const rootHash = (await utils.httpRequest(hashServerUrl + '/hash/' + address, 'GET')).data.hash
      const rootNode = await ipfs.object.get(rootHash)
      const profileHash = rootNode.links.filter(link => link.name === 'profile')[0].toJSON().multihash
      const profileNode = await ipfs.object.get(profileHash, { recursive: false })
      return JSON.parse(Buffer.from(profileNode.data).toString())
    } catch (e) {
      console.error(e)
      return {}
    }
  }

  /**
   * Opens the user space associated with the given address
   *
   * @param     {String}        address                 an ethereum address
   * @param     {Web3Provider}  web3provider            A Web3 provider
   * @param     {Object}        opts                    Optional parameters
   * @param     {IPFS}          opts.ipfs               A custom ipfs instance
   * @return    {ThreeBox}                              the threeBox instance for the given address
   */
  static async openBox (address, web3provider, opts = {}) {
    let muportDID
    let serializedMuDID = localstorage.get('serializedMuDID_' + address)
    if (serializedMuDID) {
      muportDID = new MuPort(serializedMuDID)
    } else {
      const entropy = (await utils.openBoxConsent(address, web3provider)).slice(2, 34)
      const mnemonic = bip39.entropyToMnemonic(entropy)
      muportDID = await MuPort.newIdentity(null, null, {
        externalMgmtKey: address,
        mnemonic
      })
      localstorage.set('serializedMuDID_' + address, muportDID.serializeState())
    }
    let threeBox = new ThreeBox(muportDID, web3provider, opts)
    await threeBox._sync()
    return threeBox
  }

  async _sync () {
    let rootHash
    const did = this.muportDID.getDid()
    try {
      // read root ipld object hash from 3box-hash-server
      const res = await utils.httpRequest(this.hashServerUrl + '/hash/' + did, 'GET')
      if (res.status === 'success') {
        rootHash = res.data.hash
      } else if (res.status === 'error' && res.message !== 'hash not found') {
        throw new Error(res.message)
      }
    } catch (err) {
      throw new Error(err)
    }

    if (rootHash) {
      // Get root ipld object from IPFS
      this.rootDAGNode = await this.ipfs.object.get(rootHash)
      if (!this.rootDAGNode.links.length) {
        // We got some random object from ipfs, create a real root object
        this.rootDAGNode = await createDAGNode('', [])
      }
    } else {
      this.rootDAGNode = await createDAGNode('', [])
    }
    // Sync profile and privateStore
    // TODO: both can run in parallel.
    let profileLink = this.rootDAGNode.links.filter(link => link.name === 'profile')[0]
    await this.profileStore._sync(profileLink ? profileLink.toJSON().multihash : null)
    let datastoreLink = this.rootDAGNode.links.filter(link => link.name === 'datastore')[0]
    await this.privateStore._sync(datastoreLink ? datastoreLink.toJSON().multihash : null)
  }

  async _publishUpdate (storeName, hash) {
    if (storeName === 'profile') {
      await this._linkProfile()
    }
    // Update rootObject
    this.rootDAGNode = await updateDAGNodeLink(this.rootDAGNode, storeName, hash)

    // Store rootObject on IPFS
    const rootHash = this.rootDAGNode.toJSON().multihash
    try {
      await this.ipfs.object.put(this.rootDAGNode)
    } catch (e) {
      // TODO - handle any errors here
      console.error(e)
    }

    // Sign rootHash
    const hashToken = await this.muportDID.signJWT({ hash: rootHash })

    // Store hash on 3box-hash-server
    try {
      await utils.httpRequest(this.hashServerUrl + '/hash', 'POST', { hash_token: hashToken })
    } catch (err) {
      throw new Error(err)
    }
    return true
  }

  async _linkProfile () {
    const address = this.muportDID.getDidDocument().managementKey
    if (!localstorage.get('linkConsent_' + address)) {
      const did = this.muportDID.getDid()
      const consent = await utils.getLinkConsent(address, did, this.web3provider)
      const linkData = {
        consent_msg: consent.msg,
        consent_signature: consent.sig,
        linked_did: did
      }
      // Send consentSignature to root-hash-tracker to link profile with ethereum address
      await utils.httpRequest(this.hashServerUrl + '/link', 'POST', linkData)

      // Store linkConsent into localstorage
      const linkConsent = {
        address: address,
        did: did,
        consent: consent
      }
      localstorage.set('linkConsent_' + address, linkConsent)
    }
  }

  /**
   * Closes the 3box instance without clearing the local cache.
   * Should be called after you are done using the 3Box instance,
   * but without logging the user out.
   */
  async close () {
    await this.privateStore.close()
  }

  /**
   * Closes the 3box instance and clears local cache. If you call this,
   * users will need to sign a consent message to log in the next time
   * you call openBox.
   */
  async logout () {
    await this.close()
    const address = this.muportDID.getDidDocument().managementKey
    localstorage.remove('serializedMuDID_' + address)
    localstorage.remove('linkConsent_' + address)
  }
}

const createDAGNode = (data, links) => new Promise((resolve, reject) => {
  DAGNode.create(data, links, (err, node) => {
    if (err) reject(err)
    resolve(node)
  })
})

const updateDAGNodeLink = (node, name, multihash) => new Promise((resolve, reject) => {
  DAGNode.rmLink(node, name, (err, clearedNode) => {
    if (err) reject(err)
    // size has to be set to a non-zero value
    DAGNode.addLink(clearedNode, { name, multihash, size: 1 }, (err, newNode) => {
      if (err) reject(err)
      resolve(newNode)
    })
  })
})

module.exports = ThreeBox
