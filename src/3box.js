const MuPort = require('muport-core')
const bip39 = require('bip39')
const localstorage = require('store')
const IPFS = require('ipfs')
const OrbitDB = require('orbit-db')
const Pubsub = require('orbit-db-pubsub')
const sha256 = require('js-sha256').sha256

const PublicStore = require('./publicStore')
const PrivateStore = require('./privateStore')
const OrbitdbKeyAdapter = require('./orbitdbKeyAdapter')
const utils = require('./utils')

const ADDRESS_SERVER_URL = 'https://beta.3box.io/address-server'
const PINNING_NODE = '/dnsaddr/ipfs.3box.io/tcp/443/wss/ipfs/QmbgpyTLCYBy84E1HGwei6niQHiLQmRpfN6SQtfJiyNMUd'
const PINNING_ROOM = '3box-pinning'
const IPFS_OPTIONS = {
  EXPERIMENTAL: {
    pubsub: true
  }
}

let globalIPFS
let globalOrbitDB

class ThreeBox {
  /**
   * Please use the **openBox** method to instantiate a ThreeBox
   */
  constructor (muportDID, web3provider, opts = {}) {
    this._muportDID = muportDID
    this._web3provider = web3provider
    this._serverUrl = opts.addressServer || ADDRESS_SERVER_URL
    /**
     * @property {KeyValueStore} public         access the profile store of the users threeBox
     */
    this.public = null
    /**
     * @property {KeyValueStore} private        access the private store of the users threeBox
     */
    this.private = null
  }

  async _sync (opts = {}) {
    const did = this._muportDID.getDid()
    console.time('getRootStoreAddress')
    let rootStoreAddress = await getRootStoreAddress(this._serverUrl, did)
    console.timeEnd('getRootStoreAddress')
    const didFingerprint = utils.sha256Multihash(did)
    const pinningNode = opts.pinningNode || PINNING_NODE
    console.time('start ipfs')
    this._ipfs = await initIPFS(opts.ipfsOptions)
    console.timeEnd('start ipfs')
    // TODO - if connection to this peer is lost we should try to reconnect
    console.time('connect to pinning ipfs node')
    this._ipfs.swarm.connect(pinningNode, () => {
      console.timeEnd('connect to pinning ipfs node')
    })

    // console.log(await this._ipfs.swarm.peers())
    console.time('opening pinning room, pinning node joined')
    this._pubsub = new Pubsub(this._ipfs, (await this._ipfs.id()).id)
    const onNewPeer = (topic, peer) => {
      console.log('Peer joined the room', peer)
      console.log(peer, pinningNode.split('/').pop())
      if (peer === pinningNode.split('/').pop()) {
        console.timeEnd('opening pinning room, pinning node joined')
        console.log('broadcasting odb-address')
        this._pubsub.publish(PINNING_ROOM, { odbAddress: rootStoreAddress })
      }
    }
    if (rootStoreAddress) this._pubsub.subscribe(PINNING_ROOM, () => {}, onNewPeer)

    const keystore = new OrbitdbKeyAdapter(this._muportDID)
    console.time('new OrbitDB')
    this._orbitdb = new OrbitDB(this._ipfs, opts.orbitPath, { keystore })
    console.timeEnd('new OrbitDB')
    globalIPFS = this._ipfs
    globalOrbitDB = this._orbitdb

    this.public = new PublicStore(this._orbitdb, didFingerprint + '.public', this._linkProfile.bind(this))
    this.private = new PrivateStore(this._muportDID, this._orbitdb, didFingerprint + '.private')

    if (rootStoreAddress) {
      console.time('open rootStore')
      this._rootStore = await this._orbitdb.open(rootStoreAddress)
      console.timeEnd('open rootStore')
      // this._rootStore.events.on('replicate', console.log)
      const readyPromise = new Promise((resolve, reject) => {
        this._rootStore.events.on('ready', resolve)
      })
      console.time('rootStore.load')
      this._rootStore.load()
      await readyPromise
      console.timeEnd('rootStore.load')
      // console.log('p2', (await this._ipfs.swarm.peers())[0].addr.toString())
      // console.log('p2 id', (await this._ipfs.id()).id)
      // console.log(this._rootStore.iterator({ limit: -1 }).collect().length)
      // console.log(await this._ipfs.pubsub.peers('/orbitdb/QmRxUAGk62v7NjUkzvcqwYkBqF3zHb8tfhfW6T3MateGje/b932fe7ab.root'))
      console.time('replicate rootStore')
      if (!this._rootStore.iterator({ limit: -1 }).collect().length) {
        await new Promise((resolve, reject) => {
          this._rootStore.events.on(
            'replicate.progress',
            (_x, _y, _z, num, max) => {
              if (num === max) {
                console.timeEnd('replicate rootStore')
                this._rootStore.events.on('replicated', resolve)
              }
            }
          )
        })
      }
      let storePromises = []
      console.time('sync stores')
      this._rootStore.iterator({ limit: -1 }).collect().map(entry => {
        const odbAddress = entry.payload.value.odbAddress
        const name = odbAddress.split('.')[1]
        if (name === 'public') {
          storePromises.push(this.public._sync(odbAddress))
        } else if (name === 'private') {
          storePromises.push(this.private._sync(odbAddress))
        }
      })
      await Promise.all(storePromises)
      console.timeEnd('sync stores')
    } else {
      const rootStoreName = didFingerprint + '.root'
      console.time('create rootStore')
      this._rootStore = await this._orbitdb.feed(rootStoreName)
      console.timeEnd('create rootStore')
      console.time('add PublicStore to rootStore')
      await this._rootStore.add({ odbAddress: await this.public._sync() })
      console.timeEnd('add PublicStore to rootStore')
      console.time('add PrivateStore to rootStore')
      await this._rootStore.add({ odbAddress: await this.private._sync() })
      console.timeEnd('add PrivateStore to rootStore')
      rootStoreAddress = this._rootStore.address.toString()
      console.time('publish rootStoreAddress to address-server')
      this._publishRootStore(rootStoreAddress)
      console.timeEnd('publish rootStoreAddress to address-server')
      console.time('broadcast rootStoreAddress over pubsub')
      this._pubsub.subscribe(PINNING_ROOM, () => {}, onNewPeer)
      console.timeEnd('broadcast rootStoreAddress over pubsub')
    }
  }

  /**
   * Get the public profile of a given address
   *
   * @param     {String}    address                 an ethereum address
   * @param     {Object}    opts                    Optional parameters
   * @param     {String}    opts.addressServer      URL of the Address Server
   * @param     {Object}    opts.ipfsOptions        A ipfs options object to pass to the js-ipfs constructor
   * @param     {String}    opts.orbitPath          A custom path for orbitdb storage
   * @return    {Object}                            a json object with the profile for the given address
   */
  static async getProfile (address, opts = {}) {
    const serverUrl = opts.addressServer || ADDRESS_SERVER_URL
    const rootStoreAddress = await getRootStoreAddress(serverUrl, address)
    let usingGlobalIPFS = false
    let usingGlobalOrbitDB = false
    let ipfs
    let orbitdb
    if (globalIPFS) {
      ipfs = globalIPFS
      usingGlobalIPFS = true
    } else {
      ipfs = await initIPFS(opts.ipfsOptions)
    }
    if (globalOrbitDB) {
      orbitdb = globalOrbitDB
      usingGlobalIPFS = true
    } else {
      orbitdb = new OrbitDB(ipfs, opts.orbitPath)
    }
    const publicStore = new PublicStore(orbitdb)

    if (rootStoreAddress) {
      const rootStore = await orbitdb.open(rootStoreAddress)
      const readyPromise = new Promise((resolve, reject) => {
        rootStore.events.on('ready', resolve)
      })
      rootStore.load()
      await readyPromise
      if (!rootStore.iterator({ limit: -1 }).collect().length) {
        await new Promise((resolve, reject) => {
          rootStore.events.on('replicate.progress', (_x, _y, _z, num, max) => {
            if (num === max) {
              rootStore.events.on('replicated', resolve)
            }
          })
        })
      }
      const profileEntry = rootStore
        .iterator({ limit: -1 })
        .collect()
        .find(entry => {
          return entry.payload.value.odbAddress.split('.')[1] === 'public'
        })
      await publicStore._sync(profileEntry.payload.value.odbAddress)
      const profile = publicStore.all()
      const closeAll = async () => {
        await rootStore.close()
        await publicStore.close()
        if (!usingGlobalOrbitDB) await orbitdb.stop()
        if (!usingGlobalIPFS) await ipfs.stop()
      }
      // close but don't wait for it
      closeAll()
      return profile
    } else {
      return null
    }
  }

  /**
   * Opens the user space associated with the given address
   *
   * @param     {String}        address                 an ethereum address
   * @param     {Web3Provider}  web3provider            A Web3 provider
   * @param     {Object}        opts                    Optional parameters
   * @param     {Object}        opts.ipfsOptions        A ipfs options object to pass to the js-ipfs constructor
   * @param     {String}        opts.orbitPath          A custom path for orbitdb storage
   * @param     {Function}      opts.consentCallback    A function that will be called when the user has consented to opening the box
   * @return    {ThreeBox}                              the threeBox instance for the given address
   */
  static async openBox (address, web3provider, opts = {}) {
    console.time('-- openBox --')
    let muportDID
    let serializedMuDID = localstorage.get('serializedMuDID_' + address)
    if (serializedMuDID) {
      console.time('new Muport')
      muportDID = new MuPort(serializedMuDID)
      console.timeEnd('new Muport')
      if (opts.consentCallback) opts.consentCallback(false)
    } else {
      const sig = await utils.openBoxConsent(address, web3provider)
      if (opts.consentCallback) opts.consentCallback(true)
      const entropy = sha256(sig.slice(2))
      const mnemonic = bip39.entropyToMnemonic(entropy)
      console.time('muport.newIdentity')
      muportDID = await MuPort.newIdentity(null, null, {
        externalMgmtKey: address,
        mnemonic
      })
      console.timeEnd('muport.newIdentity')
      localstorage.set('serializedMuDID_' + address, muportDID.serializeState())
    }
    console.time('new 3box')
    let threeBox = new ThreeBox(muportDID, web3provider, opts)
    console.timeEnd('new 3box')
    console.time('sync 3box')
    await threeBox._sync(opts)
    console.timeEnd('sync 3box')
    console.timeEnd('-- openBox --')
    return threeBox
  }

  async _publishRootStore (rootStoreAddress) {
    // Sign rootStoreAddress
    const addressToken = await this._muportDID.signJWT({ rootStoreAddress })
    // Store odbAddress on 3box-address-server
    try {
      await utils.httpRequest(this._serverUrl + '/odbAddress', 'POST', {
        address_token: addressToken
      })
    } catch (err) {
      throw new Error(err)
    }
    return true
  }

  async _linkProfile () {
    const address = this._muportDID.getDidDocument().managementKey
    if (!localstorage.get('linkConsent_' + address)) {
      const did = this._muportDID.getDid()
      const consent = await utils.getLinkConsent(
        address,
        did,
        this._web3provider
      )
      const linkData = {
        consent_msg: consent.msg,
        consent_signature: consent.sig,
        linked_did: did
      }
      // Send consentSignature to 3box-address-server to link profile with ethereum address
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
    await this._pubsub.disconnect()
    await this._ipfs.stop()
    globalOrbitDB = null
    globalIPFS = null
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

async function initIPFS (ipfsOptions) {
  return new Promise((resolve, reject) => {
    let ipfs = new IPFS(ipfsOptions || IPFS_OPTIONS)
    ipfs.on('error', error => {
      console.error(error)
      reject(error)
    })
    ipfs.on('ready', () => resolve(ipfs))
  })
}

async function getRootStoreAddress (serverUrl, identifier) {
  return new Promise(async (resolve, reject) => {
    try {
      // read orbitdb root store address from the 3box-address-server
      const res = await utils.httpRequest(
        serverUrl + '/odbAddress/' + identifier,
        'GET'
      )
      resolve(res.data.rootStoreAddress)
    } catch (err) {
      if (JSON.parse(err).message === 'root store address not found') {
        resolve(null)
      }
      reject(err)
    }
  })
}

module.exports = ThreeBox
