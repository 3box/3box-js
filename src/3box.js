const MuPort = require('muport-core')
const bip39 = require('bip39')
const localstorage = require('store')
const IPFS = require('ipfs')
const OrbitDB = require('orbit-db')

const ProfileStore = require('./profileStore')
const PrivateStore = require('./privateStore')
const utils = require('./utils')

// TODO: Put production 3box-hash-server instance here ;)
const HASH_SERVER_URL = 'https://api.uport.space/hash-server'
const IPFS_OPTIONS = {
  EXPERIMENTAL: {
    pubsub: true
  },
  repo: './tmp/ipfs1/'
}

class ThreeBox {
  /**
   * Please use the **openBox** method to instantiate a ThreeBox
   */
  constructor (muportDID, web3provider, opts = {}) {
    this._muportDID = muportDID
    this._web3provider = web3provider
    this._serverUrl = opts.hashServer || HASH_SERVER_URL
    /**
     * @property {ProfileStore} profileStore        access the profile store of the users threeBox
     */
    this.profileStore = null
    /**
     * @property {PrivateStore} privateStore        access the private store of the users threeBox
     */
    this.privateStore = null
  }

  async _sync () {
    const did = this._muportDID.getDid()
    const rootStoreAddress = await getRootStoreAddress(this._serverUrl, did)
    const didFingerprint = utils.sha256Multihash(did)
    this._ipfs = await initIPFS()
    this._orbitdb = new OrbitDB(this._ipfs)

    this.profileStore = new ProfileStore(this._orbitdb, didFingerprint + '.public')
    this.privateStore = new PrivateStore(this._muportDID, this._orbitdb, didFingerprint + '.private')

    console.log('root', rootStoreAddress)
    if (rootStoreAddress) {
      this._rootStore = await this._orbitdb.open(rootStoreAddress)
      const readyPromise = new Promise((resolve, reject) => {
        this._rootStore.events.on('ready', resolve)
      })
      this._rootStore.load()
      await readyPromise
      if (!this._rootStore.iterator({ limit: -1 }).collect().length) {
        await new Promise((resolve, reject) => {
          this._rootStore.events.on('replicate.progress', (_x, _y, _z, num, max) => {
            if (num === max) {
              this._rootStore.events.on('replicated', resolve)
            }
          })
        })
      }
      this._rootStore.iterator({ limit: -1 }).collect().map(async entry => {
        const odbAddress = entry.payload.value.odbAddress
        const name = odbAddress.split('.')[1]
        if (name === 'public') {
          await this.profileStore._sync(odbAddress)
        } else if (name === 'private') {
          await this.privateStore._sync(odbAddress)
        }
      })
    } else {
      const rootStoreName = didFingerprint + '.root'
      this._rootStore = await this._orbitdb.feed(rootStoreName, { write: ['*'] })
      await this._rootStore.add({ odbAddress: await this.profileStore._sync() })
      await this._rootStore.add({ odbAddress: await this.privateStore._sync() })
      await this._publishRootStore(this._rootStore.address.toString())
    }
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
    //let ipfs = opts.ipfs || new IpfsAPI('ipfs.infura.io', '5001', { protocol: 'https' })
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

  async _publishRootStore (odbAddress) {
    //if (storeName === 'profile') {
      //await this._linkProfile()
    //}

    // Sign rootStoreAddress
    const hashToken = await this._muportDID.signJWT({ odbAddress })
    // Store odbAddress on 3box-address-server
    try {
      await utils.httpRequest(this._serverUrl + '/odbAddress', 'POST', { hash_token: hashToken })
    } catch (err) {
      throw new Error(err)
    }
    return true
  }

  async _linkProfile () {
    const address = this._muportDID.getDidDocument().managementKey
    if (!localstorage.get('linkConsent_' + address)) {
      const did = this._muportDID.getDid()
      const consent = await utils.getLinkConsent(address, did, this._web3provider)
      const linkData = {
        consent_msg: consent.msg,
        consent_signature: consent.sig,
        linked_did: did
      }
      // Send consentSignature to root-hash-tracker to link profile with ethereum address
      await utils.httpRequest(this._serverUrl + '/link', 'POST', linkData)

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
    await this._orbitdb.stop()
    await this._ipfs.stop()
  }

  /**
   * Closes the 3box instance and clears local cache. If you call this,
   * users will need to sign a consent message to log in the next time
   * you call openBox.
   */
  async logout () {
    await this.close()
    const address = this._muportDID.getDidDocument().managementKey
    localstorage.remove('serializedMuDID_' + address)
    localstorage.remove('linkConsent_' + address)
  }
}

async function initIPFS (repo) {
  return new Promise((resolve, reject) => {
    let ipfs = new IPFS(IPFS_OPTIONS)
    ipfs.on('error', reject)
    ipfs.on('ready', () => resolve(ipfs))
  })
}

async function getRootStoreAddress(serverUrl, identifier) {
  return new Promise(async (resolve, reject) => {
    try {
      // read orbitdb root store address from the 3box-address-server
      const res = await utils.httpRequest(serverUrl + '/odbAddress/' + identifier, 'GET')
      resolve(res.data.odbAddress)
    } catch (err) {
      if (JSON.parse(err).message === 'odbAddress not found') {
        resolve(null)
      }
      reject(err)
    }
  })
}

module.exports = ThreeBox
