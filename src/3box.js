const IPFS = require('ipfs')
const multiaddr = require('multiaddr')
const { createLink, validateLink } = require('3id-blockchain-utils')

const ThreeId = require('./3id')
const Replicator = require('./replicator')
const PublicStore = require('./publicStore')
const PrivateStore = require('./privateStore')
const Verified = require('./verified')
const Space = require('./space')
const utils = require('./utils/index')
const idUtils = require('./utils/id')
const config = require('./config')
const BoxApi = require('./api')
const IPFSRepo = require('ipfs-repo')
const LevelStore = require('datastore-level')
const didJWT = require('did-jwt')
const { ThreeIdConnect } = require('3id-connect')
const { IframeCache } = require('3box-shared-cache')

const PINNING_NODE = config.pinning_node
const ADDRESS_SERVER_URL = config.address_server_url
const IPFS_OPTIONS = config.ipfs_options
const RENDEZVOUS_ADDRESS = config.rendezvous_address
const THREEID_CONNECT_URL = config.threeid_connect_url
const IFRAME_CACHE_URL = config.iframe_cache_url
const supportAlert = 'This site uses local data storage to give you control of your data. Please enable web APIs like localstorage, indexxeddb, etc in your browser settings.'

let globalIPFS, globalIPFSPromise, threeIdConnect, iframeCacheService, cacheSupportedPromise

const browserHuh = typeof window !== 'undefined' && typeof document !== 'undefined'
if (browserHuh) {
  require('./modernizr.js')
  threeIdConnect = new ThreeIdConnect(THREEID_CONNECT_URL)
  iframeCacheService = new IframeCache(IFRAME_CACHE_URL)
  cacheSupportedPromise = iframeCacheService.connect()
}
/**
 * @extends BoxApi
 */
class Box extends BoxApi {
  /**
   * Please use the **openBox** method to instantiate a 3Box
   * @constructor
   */
  constructor (provider, ipfs, opts = {}) {
    super()
    this._provider = provider
    this._ipfs = ipfs
    this._opts = opts
    this._serverUrl = opts.addressServer || ADDRESS_SERVER_URL
    /**
     * @property {KeyValueStore} public         access the profile store of the users 3Box
     */
    this.public = null
    /**
     * @property {KeyValueStore} private        access the private store of the users 3Box
     */
    this.private = null
    /**
     * @property {Verified} verified        check and create verifications
     */
    this.verified = new Verified(this)
    /**
     * @property {Object} spaces            an object containing all open spaces indexed by their name.
     */
    this.spaces = {}
    /**
     * @property {Promise} syncDone         A promise that is resolved when the box is synced
     */
    this.syncDone = null

    this.hasPublishedLink = {}
  }

  async _init (opts) {
    const replicatorOpts = { ...opts }

    if (opts.iframeCache && iframeCacheService) {
      const cacheSupported = await cacheSupportedPromise

      if (cacheSupported) {
        replicatorOpts.cacheProxy = iframeCacheService.getOrbitStorageProxyFactory()
      }
    }

    this.replicator = await Replicator.create(this._ipfs, replicatorOpts)

    if (opts.ghostPinbot) {
      this._ghostPinbot = opts.ghostPinbot

      const self = this
      const peerId = utils.getPeerIdFromMultiaddr(opts.ghostPinbot)

      // ping Ghost Pinbot to keep connection alive
      this.ghostPinbotKeepAliveHandle = setInterval(async () => {
        await self._ipfs.ping(peerId)
      }, 10000)
    }
  }

  async _load (opts = {}) {
    const address = opts.address || await this._3id.getAddress()
    const { rootStoreAddress, did } = address ? await this._getLinkedData(address) : {}
    // Check for ',' because a bug caused the incorrect rootstore to be linked.
    // If so we create the correct one instead.
    if (rootStoreAddress && !rootStoreAddress.includes(',')) {
      await this.replicator.start(rootStoreAddress, did, { profile: true })
      await this.replicator.rootstoreSyncDone
      const authData = await this.replicator.getAuthData()
      await this._3id.authenticate(opts.spaces, { authData, address })
    } else {
      await this._3id.authenticate(opts.spaces, { address })
      const rootstoreName = this._3id.muportFingerprint + '.root'
      const key = (await this._3id.getPublicKeys(null, true)).signingKey
      await this.replicator.new(rootstoreName, key, this._3id.DID)
      this._publishRootStore(this.replicator.rootstore.address.toString())
    }
    this.replicator.rootstore.setIdentity(await this._3id.getOdbId())
    this.syncDone = this.replicator.syncDone

    this._3id.events.on('new-auth-method', authData => {
      this._writeRootstoreEntry(Replicator.entryTypes.AUTH_DATA, authData)
    })
    this._3id.events.on('new-link-proof', proof => {
      this._writeAddressLink(proof)
    })
    this._3id.startUpdatePolling()

    this.public = new PublicStore(this._3id.muportFingerprint + '.public', this.replicator, this._3id)
    this.private = new PrivateStore(this._3id.muportFingerprint + '.private', this.replicator, this._3id)
    await this.public._load()
    await this.private._load()
  }

  /**
   * Creates an instance of 3Box
   *
   * @param     {provider}          provider                A 3ID provider, or ethereum provider
   * @param     {Object}            opts                    Optional parameters
   * @param     {String}            opts.pinningNode        A string with an ipfs multi-address to a 3box pinning node
   * @param     {Object}            opts.ipfs               A js-ipfs ipfs object
   * @param     {String}            opts.addressServer      URL of the Address Server
   * @param     {String}            opts.ghostPinbot        MultiAddress of a Ghost Pinbot node
   * @param     {String}            opts.supportCheck       Gives browser alert if 3boxjs/ipfs not supported in browser env, defaults to true. You can also set to false to implement your own alert and call Box.support to check if supported.
   * @param     {Boolean}           opts.iframeCache        Enable iframe cache for ipfs/orbit, defaults to true
   * @return    {Box}                                       the 3Box session instance
   */
  static async create (provider, opts = {}) {
    if (opts.supportCheck !== false && browserHuh) await this._supportAlert()
    opts.iframeCache = typeof opts.iframeCache === 'boolean' ? opts.iframeCache : true
    const ipfs = await Box.getIPFS(opts)
    const box = new Box(provider, ipfs, opts)
    await box._setProvider(provider)
    await box._init(opts)
    return box
  }

  static async _supportAlert () {
    const supported = await this.supported()
    if (!supported) window.alert(supportAlert)
  }

  /**
   * Determines if this browser environment supports 3boxjs and ipfs.
   *
   * @return    {Boolean}
   */
  static async supported () {
    return new Promise((resolve, reject) => {
      if (!browserHuh) throw new Error('Supported only detects browser feature support')
      window.Modernizr.on('indexeddb', resolve)
    })
  }

  static get3idConnectProvider () {
    throw new Error('3idConnectProvider function is no longer supported, initialize 3box as you did before 3idConnectProvider by passing a provider to Box.create or box.auth, and 3box will create a 3idConnectProvider in the background using your given provider - https://medium.com/3box/introducing-3id-connect-531af4f84d3f')
  }

  async _setProvider (provider) {
    if (!provider) return
    // This will still allow an ethprovider if no threeIdConnect for now, but later will only consume 3idproviders
    if (!provider.is3idProvider && threeIdConnect) {
      await threeIdConnect.connect(provider, ThreeId, this._ipfs)
      this._provider = await threeIdConnect.get3idProvider()
    } else {
      this._provider = provider
    }
  }

  /**
   * Authenticate the user
   *
   * @param     {Array<String>}     spaces                  A list of spaces to authenticate (optional)
   * @param     {Object}            opts                    Optional parameters
   * @param     {String}            opts.address            An ethereum address
   * @param     {String}            opts.provider           A 3ID provider, or ethereum provider
   * @param     {Function}          opts.consentCallback    A function that will be called when the user has consented to opening the box
   */
  async auth (spaces = [], opts = {}) {
    if (opts.provider) await this._setProvider(opts.provider)
    if (!this._provider) throw new Error('auth: provider was not passed to auth or create, provider required')
    opts.address = opts.address ? opts.address.toLowerCase() : opts.address
    this._3idEthAddress = opts.address

    if (!this._3id) {
      if (!this._provider.is3idProvider && !opts.address) throw new Error('auth: address needed when 3ID provider is not used')
      this._3id = await ThreeId.getIdFromEthAddress(opts.address, this._provider, this._ipfs, this.replicator._orbitdb.keystore, opts)
      await this._load(Object.assign(opts, { spaces }))
    } else {
      // box already loaded, just authenticate spaces
      if (this._provider.threeIdConnect && this._provider.migration && !opts.address) {
        throw new Error('auth: address needed when 3ID provider not given')
      }
      await this._3id.authenticate(spaces, { address: opts.address })
    }
    // Link address if needed
    await this.linkAddress()
    // make sure we are authenticated to threads
    await Promise.all(spaces.map(async space => {
      await this.openSpace(space)
    }))
  }

  /**
   * Opens the 3Box associated with the given address
   *
   * @param     {String}            address                 An ethereum address
   * @param     {provider}          provider                An ethereum or 3ID provider
   * @param     {Object}            opts                    Optional parameters
   * @param     {Function}          opts.consentCallback    A function that will be called when the user has consented to opening the box
   * @param     {String}            opts.pinningNode        A string with an ipfs multi-address to a 3box pinning node
   * @param     {Object}            opts.ipfs               A js-ipfs ipfs object
   * @param     {String}            opts.addressServer      URL of the Address Server
   * @param     {String}            opts.contentSignature   A signature, provided by a client of 3box using the private keys associated with the given address, of the 3box consent message
   * @return    {Box}                                       the 3Box instance for the given address
   */
  static async openBox (address, provider, opts = {}) {
    opts = Object.assign(opts, { address })
    const box = await Box.create(provider, opts)
    await box.auth([], opts)
    return box
  }

  /**
   * Opens the space with the given name in the users 3Box
   *
   * @param     {String}            name                    The name of the space
   * @param     {Object}            opts                    Optional parameters
   * @param     {Function}          opts.consentCallback    A function that will be called when the user has consented to opening the box
   * @param     {Function}          opts.onSyncDone         A function that will be called when the space has finished syncing with the pinning node
   * @return    {Space}                                     the Space instance for the given space name
   */
  async openSpace (name, opts = {}) {
    opts = Object.assign(opts, { address: this._3idEthAddress })
    if (name.includes('.')) throw new Error('Invalid name: character "." not allowed')
    if (!this._3id) throw new Error('openSpace: auth required')
    if (!this.spaces[name]) {
      this.spaces[name] = new Space(name, this.replicator)
    }
    if (!this.spaces[name].isOpen) {
      try {
        await this.spaces[name].open(this._3id, opts)
      } catch (e) {
        delete this.spaces[name]
        if (e.message.includes('User denied message signature.')) {
          throw new Error('User denied space consent.')
        } else {
          throw new Error('An error occurred while opening space: ', e)
        }
      }
    } else if (opts.onSyncDone) {
      // since the space is already open we can call onSyncDone directly
      opts.onSyncDone()
    }
    return this.spaces[name]
  }

  /**
   * Open a thread. Use this to start receiving updates
   *
   * @param     {String}    space                   The name of the space for this thread
   * @param     {String}    name                    The name of the thread
   * @param     {Object}    opts                    Optional parameters
   * @param     {String}    opts.firstModerator     DID of first moderator of a thread, by default, user is first moderator
   * @param     {Boolean}   opts.members            join a members only thread, which only members can post in, defaults to open thread
   * @param     {Boolean}   opts.noAutoSub          Disable auto subscription to the thread when posting to it (default false)
   * @param     {Boolean}   opts.ghost              Enable ephemeral messaging via Ghost Thread
   * @param     {Number}    opts.ghostBacklogLimit  The number of posts to maintain in the ghost backlog
   * @param     {Array<Function>} opts.ghostFilters Array of functions for filtering messages
   *
   * @return    {Thread}                  An instance of the thread class for the joined thread
   */
  async openThread (space, name, opts) {
    if (!this.spaces[space]) {
      this.spaces[space] = new Space(space, this.replicator)
    }

    if (this._ghostPinbot) {
      const options = opts || {}
      options.ghostPinbot = this._ghostPinbot
    }
    return this.spaces[space].joinThread(name, opts)
  }

  /**
   * Sets the callback function that will be called once when the box is fully synced.
   *
   * @param     {Function}      syncDone        The function that will be called
   * @return    {Promise}                       A promise that is fulfilled when the box is syned
   */
  async onSyncDone (syncDone) {
    await this.syncDone
    syncDone()
  }

  async _publishRootStore (rootStoreAddress) {
    // Sign rootstoreAddress
    const addressToken = await this._3id.signJWT({ rootStoreAddress })
    // Store odbAddress on 3box-address-server
    const publish = async token => {
      try {
        await utils.fetchJson(this._serverUrl + '/odbAddress', {
          address_token: token
        })
      } catch (err) {
        if (err.message === 'Invalid JWT') {
          // we tried to publish before address-server has access to 3ID
          // so it can't verify the JWT. Retry until it is available
          await new Promise(resolve => setTimeout(resolve, 300))
          await publish(token)
        }
        // we capture http errors (500, etc)
        // see: https://github.com/3box/3box-js/pull/351
        if (!err.statusCode) {
          throw new Error(err)
        }
      }
    }
    await publish(addressToken)
    return true
  }

  async _getLinkedData (ethereumAddress) {
    try {
      const { rootStoreAddress, did } = (await utils.fetchJson(`${this._serverUrl}/odbAddress/${ethereumAddress}`)).data
      return { rootStoreAddress, did }
    } catch (err) {
      if (err.statusCode === 404) {
        return {}
      }
      throw new Error('Error while getting rootstore', err)
    }
  }

  /**
   * @property {String} DID        the DID of the user
   */
  get DID () {
    if (!this._3id) throw new Error('DID: auth required')
    return this._3id.DID
  }

  /**
   * Creates a proof that links an ethereum address to the 3Box account of the user. If given proof, it will simply be added to the root store.
   *
   * @param     {Object}    [link]                         Optional link object with type or proof
   * @param     {Object}    [link.proof]                   Proof object, should follow [spec](https://github.com/3box/3box/blob/master/3IPs/3ip-5.md)
   */
  async linkAddress (link = {}) {
    if (!this._3id) throw new Error('linkAddress: auth required')
    if (link.proof) {
      await this._writeAddressLink(link.proof)
    } else {
      await this._linkProfile()
    }
  }

  /**
   * Remove given address link, returns true if successful
   *
   * @param     {String}   address      address that is linked
   */
  async removeAddressLink (address) {
    if (!this._3id) throw new Error('removeAddressLink: auth required')
    address = address.toLowerCase()
    const linkExist = await this.isAddressLinked({ address })
    if (!linkExist) throw new Error('removeAddressLink: link for given address does not exist')
    const payload = {
      address,
      type: 'delete-address-link'
    }
    const oneHour = 60 * 60
    const deleteToken = await this._3id.signJWT(payload, { expiresIn: oneHour })

    try {
      await utils.fetchJson(this._serverUrl + '/linkdelete', {
        delete_token: deleteToken
      })
    } catch (err) {
      // we capture http errors (500, etc)
      // see: https://github.com/3box/3box-js/pull/351
      if (!err.statusCode) {
        throw new Error(err)
      }
    }

    await this._deleteAddressLink(address)

    return true
  }

  /**
   * Checks if there is a proof that links an external account to the 3Box account of the user. If not params given and any link exists, returns true
   *
   * @param     {Object}    [query]            Optional object with address and/or type.
   * @param     {String}    [query.type]       Does the given type of link exist
   * @param     {String}    [query.address]    Is the given adressed linked
   */
  async isAddressLinked (query = {}) {
    if (!this._3id) throw new Error('isAddressLinked: auth required')
    if (query.address) query.address = query.address.toLowerCase()
    const links = await this._readAddressLinks()
    const linksQuery = links.find(link => {
      const res = query.address ? link.address.toLowerCase() === query.address : true
      return query.type ? res && link.type === query.type : res
    })
    return Boolean(linksQuery)
  }

  /**
   * Lists address links associated with this 3Box
   *
   * @return    {Array}                        An array of link objects
   */
  async listAddressLinks () {
    if (!this._3id) throw new Error('listAddressLinks: auth required')
    const entries = await this._readAddressLinks()
    return entries.reduce((list, entry) => {
      const item = Object.assign({}, entry)
      item.linkId = item.entry.hash
      delete item.entry
      list.push(item)
      return list
    }, [])
  }

  async _writeAddressLink (proof) {
    const validProof = await validateLink(proof)
    if (!validProof) {
      throw new Error('tried to write invalid link proof', proof)
    }
    if (await this.isAddressLinked({ address: validProof.address })) return true // address already linked
    await this._writeRootstoreEntry(Replicator.entryTypes.ADDRESS_LINK, proof)
    await utils.fetchJson(this._serverUrl + '/link', proof)
  }

  async _linkProfile () {
    const address = await this._3id.getAddress()
    let proof = await this._readAddressLink(address)

    if (!proof) {
      if (!this._provider.is3idProvider) {
        try {
          proof = await createLink(this._3id.DID, address, this._provider)
        } catch (e) {
          throw new Error('Link consent message must be signed before adding data, to link address to store', e)
        }
        try {
          await this._writeAddressLink(proof)
        } catch (err) {
          throw new Error('An error occured while publishing link:', err)
        }
      }
    } else {
      // Send consentSignature to 3box-address-server to link profile with ethereum address
      // _writeAddressLink already does this if the other conditional is called
      if (!this.hasPublishedLink[proof.signature]) {
        // Don't want to publish on every call to _linkProfile
        this.hasPublishedLink[proof.signature] = true
        try {
          // Send consentSignature to 3box-address-server to link profile with ethereum address
          await utils.fetchJson(this._serverUrl + '/link', proof)
        } catch (err) {
          throw new Error('An error occured while publishing link:', err)
        }
      }
    }
    // Ensure we self-published our did
    // TODO - is this still needed?
    const proofdid = await this.public.get('proof_did')

    if (proofdid) {
      // if prior muport, re publish with 3id including muport
      const issuer = didJWT.decodeJWT(proofdid).payload.iss
      if (issuer.includes('muport')) {
        const jwt = { muport: proofdid }
        await this.public.set('proof_did', await this._3id.signJWT(jwt))
      }
    } else {
      // we can just sign an empty JWT as a proof that we own this DID
      await this.public.set('proof_did', await this._3id.signJWT())
    }
  }

  async _writeRootstoreEntry (type, payload) {
    const cid = (await this._ipfs.dag.put(payload)).toBaseEncodedString()
    await this._ipfs.pin.add(cid)
    const entryExist = await this._typeCIDExists(type, cid)
    if (entryExist) return
    const entry = {
      type,
      data: cid
    }
    // the below code prevents multiple simultaneous writes,
    // which orbitdb doesn't support
    const prev = this._rootstoreQueue
    this._rootstoreQueue = (async () => {
      if (prev) await prev
      await this.replicator.rootstore.add(entry)
    })()
  }

  async _typeCIDExists (type, cid) {
    const entries = await this.replicator.rootstore.iterator({ limit: -1 }).collect()
    const typeEntries = entries.filter(e => e.payload.value.type === type)
    return Boolean(typeEntries.find(entry => entry.data === cid))
  }

  async _deleteAddressLink (address) {
    address = address.toLowerCase()
    const link = await this._readAddressLink(address)
    if (!link) throw new Error('_deleteAddressLink: link for given address does not exist')
    return this.replicator.rootstore.remove(link.entry.hash)
  }

  async _readAddressLinks () {
    const links = await this.replicator.getAddressLinks()
    const allLinks = await Promise.all(links.map(validateLink))
    return allLinks.filter(Boolean)
  }

  async _readAddressLink (address) {
    address = address.toLowerCase()
    const links = await this._readAddressLinks()
    return links.find(link => link.address.toLowerCase() === address)
  }

  async close () {
    if (!this._3id) throw new Error('close: auth required')
    await this._3id.stopUpdatePolling()
    if (this.ghostPinbotKeepAliveHandle) {
      clearInterval(this.ghostPinbotKeepAliveHandle)
    }
    await this.replicator.stop()
  }

  /**
   * Closes the 3box instance and clears local cache. If you call this,
   * users will need to sign a consent message to log in the next time
   * you call openBox.
   */
  async logout () {
    if (!this._3id) throw new Error('logout: auth required')

    await this.close()
    this._3id.logout()

    delete this._3idEthAddress
    delete this.replicator
    delete this._3id

    this.public = null
    this.private = null
    this.spaces = {}
    this.syncDone = null
    this.hasPublishedLink = {}

    await this._init(this._opts)
  }

  /**
   * Check if the given address is logged in
   *
   * @param     {String}    address                 An ethereum address
   * @return    {Boolean}                           true if the user is logged in
   */
  static isLoggedIn (address) {
    console.warn('Box.isLoggedIn: function no longer supported, simply call auth and it will not prompt user again if they have already authenticated')
    return ThreeId.isLoggedIn(address)
  }

  /**
   * Instanciate ipfs used by 3Box without calling openBox.
   *
   * @return    {IPFS}                           the ipfs instance
   */
  static async getIPFS (opts = {}) {
    if (browserHuh) {
      globalIPFS = window.globalIPFS
      globalIPFSPromise = window.globalIPFSPromise
    }

    if (!globalIPFS && !globalIPFSPromise) {
      globalIPFSPromise = initIPFS(opts.ipfs, opts.iframeStore, opts.ipfsOptions, opts.iframeCache)
    }
    if (browserHuh) window.globalIPFSPromise = globalIPFSPromise

    if (!globalIPFS) globalIPFS = await globalIPFSPromise
    if (browserHuh) window.globalIPFS = globalIPFS

    const ipfs = globalIPFS
    const pinningNode = opts.pinningNode || PINNING_NODE
    ipfs.swarm.connect(pinningNode)
    if (opts.ghostPinbot) {
      ipfs.swarm.connect(opts.ghostPinbot)
    }
    if (browserHuh && ipfs.libp2p && !opts.disableRendezvous) {
      ipfs.libp2p.transportManager.listen(multiaddr(RENDEZVOUS_ADDRESS)).catch(console.warn)
    }
    return ipfs
  }
}

async function initIPFSRepo (iframeCache) {
  let repoOpts = {}
  let ipfsRootPath

  // if in browser, create unique root storage, and ipfs id on each instance
  if (typeof window !== 'undefined' && window.indexedDB) {
    const sessionID = utils.randInt(10000)
    ipfsRootPath = 'ipfs/root/' + sessionID
    const levelInstance = new LevelStore(ipfsRootPath)

    const ipfsDatastorePath = 'ipfs/datastore' // path name level-js-ipfs/datastore
    const levelDatastore = new LevelStore(ipfsDatastorePath)

    repoOpts = {
      storageBackends: {
        root: () => levelInstance,
        datastore: () => levelDatastore
      }
    }

    if (iframeCache && iframeCacheService) {
      const cacheSupported = await cacheSupportedPromise
      if (cacheSupported) {
        repoOpts.storageBackends.blocks = iframeCacheService.getIpfsStorageProxy()
      }
    }
  }

  const repo = new IPFSRepo('ipfs', repoOpts)

  return {
    repo,
    rootPath: ipfsRootPath
  }
}

async function initIPFS (ipfs, iframeStore, ipfsOptions, iframeCache) {
  if (!!ipfs && iframeCache) console.warn('Warning: Caching in iframe is true, but the given ipfs object that is being used may not be using the iframe cache')
  if (ipfs) {
    return ipfs
  } else {
    // return ipfsProxy
    let ipfsRepo
    if (!ipfsOptions) {
      if (ipfsOptions && iframeCache) console.warn('Warning: Caching in iframe is true, but received ipfs options which may not include the proper repo configuration for using the iframe cache')
      ipfsRepo = await initIPFSRepo(iframeCache)
      ipfsOptions = Object.assign(IPFS_OPTIONS, { repo: ipfsRepo.repo })
    }
    ipfs = await IPFS.create(ipfsOptions)

    if (ipfsRepo && typeof window !== 'undefined' && window.indexedDB) {
      // deletes once db is closed again
      window.indexedDB.deleteDatabase(ipfsRepo.rootPath)
    }

    return ipfs
  }
}

Box.idUtils = idUtils

module.exports = Box
