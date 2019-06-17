const localstorage = require('store')
const IPFS = require('ipfs')
const OrbitDB = require('orbit-db')
const Pubsub = require('orbit-db-pubsub')
// const OrbitDBCacheProxy = require('orbit-db-cache-postmsg-proxy').Client
// const { createProxyClient } = require('ipfs-postmsg-proxy')
const AccessControllers = require('orbit-db-access-controllers')
const {
  LegacyIPFS3BoxAccessController,
  ThreadAccessController,
  ModeratorAccessController
} = require('3box-orbitdb-plugins')
AccessControllers.addAccessController({ AccessController: LegacyIPFS3BoxAccessController })
AccessControllers.addAccessController({ AccessController: ThreadAccessController })
AccessControllers.addAccessController({ AccessController: ModeratorAccessController })

const ThreeId = require('./3id')
const PublicStore = require('./publicStore')
const PrivateStore = require('./privateStore')
const Verified = require('./verified')
const Space = require('./space')
const utils = require('./utils/index')
const idUtils = require('./utils/id')
const config = require('./config.js')
const API = require('./api')

const ACCOUNT_TYPES = {
  ethereum: 'ethereum',
  ethereumEOA: 'ethereum-eoa'
}

const ADDRESS_SERVER_URL = config.address_server_url
const PINNING_NODE = config.pinning_node
const PINNING_ROOM = config.pinning_room
// const IFRAME_STORE_VERSION = '0.0.3'
// const IFRAME_STORE_URL = `https://iframe.3box.io/${IFRAME_STORE_VERSION}/iframe.html`
const IPFS_OPTIONS = config.ipfs_options

let globalIPFS, globalOrbitDB // , ipfsProxy, cacheProxy, iframeLoadedPromise

/*
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const iframe = document.createElement('iframe')
  iframe.src = IFRAME_STORE_URL
  iframe.style = 'width:0; height:0; border:0; border:none !important'

  iframeLoadedPromise = new Promise((resolve, reject) => {
    iframe.onload = () => { resolve() }
  })

  document.body.appendChild(iframe)
  // Create proxy clients that talks to the iframe
  const postMessage = iframe.contentWindow.postMessage.bind(iframe.contentWindow)
  ipfsProxy = createProxyClient({ postMessage })
  cacheProxy = OrbitDBCacheProxy({ postMessage })
} */

class Box {
  /**
   * Please use the **openBox** method to instantiate a 3Box
   */
  constructor (threeId, ethereumProvider, ipfs, opts = {}) {
    this._3id = threeId
    this._web3provider = ethereumProvider
    this._ipfs = ipfs
    this._serverUrl = opts.addressServer || ADDRESS_SERVER_URL
    this._onSyncDoneCB = () => {}
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

    // local store of all pinning server pubsub messages seen related to spaces
    this.spacesPubSubMessages = {}
  }

  async _load (opts = {}) {
    const rootStoreName = this._3id.muportFingerprint + '.root'

    this.pinningNode = opts.pinningNode || PINNING_NODE
    this._ipfs.swarm.connect(this.pinningNode, () => {})

    this._orbitdb = await OrbitDB.createInstance(this._ipfs, {
      directory: opts.orbitPath,
      identity: await this._3id.getOdbId()
    }) // , { cache })
    globalOrbitDB = this._orbitdb

    const key = this._3id.getKeyringBySpaceName(rootStoreName).getPublicKeys(true).signingKey
    this._rootStore = await this._orbitdb.feed(rootStoreName, {
      format: 'dag-pb',
      accessController: {
        write: [key],
        type: 'legacy-ipfs-3box',
        skipManifest: true
      }
    })
    const rootStoreAddress = this._rootStore.address.toString()
    this._pubsub = new Pubsub(this._ipfs, (await this._ipfs.id()).id)

    const onNewPeer = async (topic, peer) => {
      if (peer === this.pinningNode.split('/').pop()) {
        this._pubsub.publish(PINNING_ROOM, {
          type: 'PIN_DB',
          odbAddress: rootStoreAddress,
          did: this._3id.muportDID
        })
      }
    }

    this.public = new PublicStore(this._orbitdb, this._3id.muportFingerprint + '.public', this._linkProfile.bind(this), this._ensurePinningNodeConnected.bind(this), this._3id)
    this.private = new PrivateStore(this._orbitdb, this._3id.muportFingerprint + '.private', this._ensurePinningNodeConnected.bind(this), this._3id)

    const [pubStoreAddress, privStoreAddress] = await Promise.all([
      this.public._load(),
      this.private._load()
    ])

    let syncPromises = []
    let hasResponse = {}

    // Filters and store space related messages for 3secs, the best effort
    // simple approach, until refactor
    let spaceMessageFilterActive = true
    let filterTimeSet = false

    const onMessageRes = async (topic, data) => {
      if (!filterTimeSet) {
        filterTimeSet = true
        setTimeout(() => { spaceMessageFilterActive = false }, 3000)
      }
      if (data.type === 'HAS_ENTRIES') {
        if (data.odbAddress === privStoreAddress && !hasResponse[privStoreAddress]) {
          syncPromises.push(this.private._sync(data.numEntries))
          hasResponse[privStoreAddress] = true
        }
        if (data.odbAddress === pubStoreAddress && !hasResponse[pubStoreAddress]) {
          syncPromises.push(this.public._sync(data.numEntries))
          hasResponse[pubStoreAddress] = true
        }
        if (spaceMessageFilterActive && data.odbAddress.includes('space') === true) {
          this.spacesPubSubMessages[data.odbAddress] = data
        }
        if (syncPromises.length === 2) {
          const promises = syncPromises
          syncPromises = []
          await Promise.all(promises)
          this._onSyncDoneCB()
          // this._pubsub.unsubscribe(PINNING_ROOM)
        }
      }
    }

    this._pubsub.subscribe(PINNING_ROOM, onMessageRes, onNewPeer)

    this._createRootStore(rootStoreAddress, privStoreAddress, pubStoreAddress, this.pinningNode)
  }

  async _createRootStore (rootStoreAddress, privOdbAddress, pubOdbAddress) {
    await this._rootStore.load()
    const entries = await this._rootStore.iterator({ limit: -1 }).collect()
    if (!entries.find(e => e.payload.value.odbAddress === pubOdbAddress)) {
      await this._rootStore.add({ odbAddress: pubOdbAddress })
    }
    if (!entries.find(e => e.payload.value.odbAddress === privOdbAddress)) {
      await this._rootStore.add({ odbAddress: privOdbAddress })
    }
    this._publishRootStore(rootStoreAddress)
  }

  /**
   * Get the public profile of a given address
   *
   * @param     {String}    address                 An ethereum address
   * @param     {Object}    opts                    Optional parameters
   * @param     {Function}  opts.blocklist          A function that takes an address and returns true if the user has been blocked
   * @param     {String}    opts.metadata           flag to retrieve metadata
   * @param     {String}    opts.addressServer      URL of the Address Server
   * @param     {Object}    opts.ipfs               A js-ipfs ipfs object
   * @param     {Boolean}   opts.useCacheService    Use 3Box API and Cache Service to fetch profile instead of OrbitDB. Default true.
   * @param     {String}    opts.profileServer      URL of Profile API server
   * @return    {Object}                            a json object with the profile for the given address
   */
  static async getProfile (address, opts = {}) {
    const metadata = opts.metadata
    opts = Object.assign({ useCacheService: true }, opts)

    let profile
    if (opts.useCacheService) {
      profile = await API.getProfile(address, opts.profileServer, { metadata })
    } else {
      if (metadata) {
        throw new Error('getting metadata is not yet supported outside of the API')
      }

      const normalizedAddress = address.toLowerCase()
      profile = await this._getProfileOrbit(normalizedAddress, opts)
    }
    return profile
  }

  /**
   * Get a list of public profiles for given addresses. This relies on 3Box profile API.
   *
   * @param     {Array}     address                 An array of ethereum addresses
   * @param     {Object}    opts                    Optional parameters
   * @param     {String}    opts.profileServer      URL of Profile API server
   * @return    {Object}                            a json object with each key an address and value the profile
   */
  static async getProfiles (addressArray, opts = {}) {
    return API.getProfiles(addressArray, opts)
  }

  /**
   * Get the public data in a space of a given address with the given name
   *
   * @param     {String}    address                 An ethereum address
   * @param     {String}    name                    A space name
   * @param     {Object}    opts                    Optional parameters
   * @param     {Function}  opts.blocklist          A function that takes an address and returns true if the user has been blocked
   * @param     {String}    opts.metadata           flag to retrieve metadata
   * @param     {String}    opts.profileServer      URL of Profile API server
   * @return    {Object}                            a json object with the public space data
   */
  static async getSpace (address, name, opts = {}) {
    return API.getSpace(address, name, opts.profileServer, opts)
  }

  /**
   * Get all posts that are made to a thread.
   *
   * @param     {String}    space                   The name of the space the thread is in
   * @param     {String}    name                    The name of the thread
   * @param     {String}    firstModerator          The DID (or ethereum address) of the first moderator
   * @param     {Boolean}   members                 True if only members are allowed to post
   * @param     {Object}    opts                    Optional parameters
   * @param     {String}    opts.profileServer      URL of Profile API server
   * @return    {Array<Object>}                     An array of posts
   */
  static async getThread (space, name, firstModerator, members, opts = {}) {
    return API.getThread(space, name, firstModerator, members, opts)
  }

  /**
   * Get all posts that are made to a thread.
   *
   * @param     {String}    address                 The orbitdb-address of the thread
   * @param     {Object}    opts                    Optional parameters
   * @param     {String}    opts.profileServer      URL of Profile API server
   * @return    {Array<Object>}                     An array of posts
   */
  static async getThreadByAddress (address, opts = {}) {
    return API.getThreadByAddress(address, opts)
  }

  /**
   * Get the configuration of a users 3Box
   *
   * @param     {String}    address                 The ethereum address
   * @param     {Object}    opts                    Optional parameters
   * @param     {String}    opts.profileServer      URL of Profile API server
   * @return    {Array<Object>}                     An array of posts
   */
  static async getConfig (address, opts = {}) {
    return API.getConfig(address, opts)
  }

  /**
   * Get the names of all spaces a user has
   *
   * @param     {String}    address                 An ethereum address
   * @param     {Object}    opts                    Optional parameters
   * @param     {String}    opts.profileServer      URL of Profile API server
   * @return    {Object}                            an array with all spaces as strings
   */
  static async listSpaces (address, opts = {}) {
    return API.listSpaces(address, opts.profileServer)
  }

  static async _getProfileOrbit (address, opts = {}) {
    if (idUtils.isMuportDID(address)) {
      throw new Error('DID are supported in the cached version only')
    }

    // opts = Object.assign({ iframeStore: true }, opts)
    const rootStoreAddress = await API.getRootStoreAddress(address.toLowerCase(), opts.addressServer)
    let usingGlobalIPFS = false
    let usingGlobalOrbitDB = false
    let ipfs
    let orbitdb
    if (globalIPFS) {
      ipfs = globalIPFS
      usingGlobalIPFS = true
    } else {
      ipfs = await initIPFS(opts.ipfs, opts.iframeStore, opts.ipfsOptions)
    }
    if (globalOrbitDB) {
      orbitdb = globalOrbitDB
      usingGlobalIPFS = true
    } else {
      const cache = null // (opts.iframeStore && !!cacheProxy) ? cacheProxy : null
      orbitdb = new OrbitDB(ipfs, opts.orbitPath, { cache })
    }

    const pinningNode = opts.pinningNode || PINNING_NODE
    ipfs.swarm.connect(pinningNode, () => {})

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
      await publicStore._load(profileEntry.payload.value.odbAddress)
      await publicStore._sync()
      const profile = publicStore.all()
      const closeAll = async () => {
        await rootStore.close()
        await publicStore.close()
        if (!usingGlobalOrbitDB) await orbitdb.stop()
        if (!usingGlobalIPFS) {} // await ipfs.stop()
      }
      // close but don't wait for it
      closeAll()
      return profile
    } else {
      return null
    }
  }

  /**
   * GraphQL for 3Box profile API
   *
   * @param     {Object}    query               A graphQL query object.
   * @param     {Object}    opts                Optional parameters
   * @param     {String}    opts.graphqlServer  URL of graphQL 3Box profile service
   * @return    {Object}                        a json object with each key an address and value the profile
   */

  static async profileGraphQL (query, opts = {}) {
    return API.profileGraphQL(query, opts.graphqlServer)
  }

  /**
   * Verifies the proofs of social accounts that is present in the profile.
   *
   * @param     {Object}            profile                 A user profile object, received from the `getProfile` function
   * @return    {Object}                                    An object containing the accounts that have been verified
   */
  static async getVerifiedAccounts (profile) {
    return API.getVerifiedAccounts(profile)
  }

  /**
   * Opens the 3Box associated with the given address
   *
   * @param     {String}            address                 An ethereum address
   * @param     {ethereumProvider}  ethereumProvider        An ethereum provider
   * @param     {Object}            opts                    Optional parameters
   * @param     {Function}          opts.consentCallback    A function that will be called when the user has consented to opening the box
   * @param     {String}            opts.pinningNode        A string with an ipfs multi-address to a 3box pinning node
   * @param     {Object}            opts.ipfs               A js-ipfs ipfs object
   * @param     {String}            opts.addressServer      URL of the Address Server
   * @return    {Box}                                       the 3Box instance for the given address
   */
  static async openBox (address, ethereumProvider, opts = {}) {
    // opts = Object.assign({ iframeStore: true }, opts)
    const ipfs = globalIPFS || await initIPFS(opts.ipfs, opts.iframeStore, opts.ipfsOptions)
    globalIPFS = ipfs
    const _3id = await ThreeId.getIdFromEthAddress(address, ethereumProvider, ipfs, opts)
    const box = new Box(_3id, ethereumProvider, ipfs, opts)
    await box._load(opts)
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
    if (!this.spaces[name]) {
      this.spaces[name] = new Space(name, this._3id, this._orbitdb, this._rootStore, this._ensurePinningNodeConnected.bind(this))
      try {
        opts = Object.assign({ numEntriesMessages: this.spacesPubSubMessages }, opts)
        await this.spaces[name].open(opts)
        if (!await this.isAddressLinked()) this.linkAddress()
      } catch (e) {
        delete this.spaces[name]
        if (e.message.includes('User denied message signature.')) {
          throw new Error('User denied space consent.')
        } else {
          throw new Error('An error occured while opening space: ', e.message)
        }
      }
    } else if (opts.onSyncDone) {
      // since the space is already open we can call onSyncDone directly
      opts.onSyncDone()
    }
    return this.spaces[name]
  }

  /**
   * Sets the callback function that will be called once when the db is fully synced.
   *
   * @param     {Function}      syncDone        The function that will be called
   */
  onSyncDone (syncDone) {
    this._onSyncDoneCB = syncDone
  }

  async _publishRootStore (rootStoreAddress) {
    // Sign rootStoreAddress
    const addressToken = await this._3id.signJWT({ rootStoreAddress })
    // Store odbAddress on 3box-address-server
    try {
      await utils.fetchJson(this._serverUrl + '/odbAddress', {
        address_token: addressToken
      })
    } catch (err) {
      // we capture http errors (500, etc)
      // see: https://github.com/3box/3box-js/pull/351
      if (!err.statusCode) {
        throw new Error(err)
      }
    }
    return true
  }

  /**
   * Creates a proof that links an external account to the 3Box account of the user.
   *
   * @param     {String}        type        The type of link (default 'ethereum')
   */
  async linkAddress (type = ACCOUNT_TYPES.ethereum, proof) {
    // TODOtake proof/args or just default to managementAddress? or another func
    // await this._writeAddressLink(proof)
    if (type === ACCOUNT_TYPES.ethereum) {
      await this._linkProfile()
    }
  }

  async linkAccount (type = ACCOUNT_TYPES.ethereum) {
    console.warn('linkAccount: deprecated, please use linkAddress going forward')
    await this.linkAddress(type)
  }

  /**
   * Checks if there is a proof that links an external account to the 3Box account of the user.
   *
   * @param     {String}        type        The type of link (default ethereum)
   */
  async isAddressLinked (type = ACCOUNT_TYPES.ethereum) {
    // TODO rebase with addresslink, and will this take address arg? or just defeault to check managementAddress, or another func
    if (type === ACCOUNT_TYPES.ethereum) {
      // TODO get from root store
      return Boolean(await this.public.get('ethereum_proof'))
    }
  }

  async isAccountLinked (type = ACCOUNT_TYPES.ethereum) {
    console.warn('isAccountLinked: deprecated, please use isAddressLinked going forward')
    return this.isAddressLinked(type)
  }

  async _linkProfile () {
    const address = this._3id.managementAddress
    let linkData = await this._readAddressLink(address)

    if (!linkData) {
      const did = this._3id.muportDID
      let consent
      try {
        consent = await utils.getLinkConsent(address, did, this._web3provider)
      } catch (e) {
        console.log(e)
        throw new Error('Link consent message must be signed before adding data, to link address to store')
      }

      linkData = {
        version: 1,
        type: ACCOUNT_TYPES.ethereumEOA,
        message: consent.msg,
        signature: consent.sig,
        timestamp: consent.timestamp
      }

      await this._writeAddressLink(linkData)
    }

    // Ensure we self-published our did
    if (!(await this.public.get('proof_did'))) {
      // we can just sign an empty JWT as a proof that we own this DID
      await this.public.set('proof_did', await this._3id.signJWT(), { noLink: true })
    }

    // Send consentSignature to 3box-address-server to link profile with ethereum address
    utils.fetchJson(this._serverUrl + '/link', linkData).catch(console.error)
  }

  async _writeAddressLink(proof) {
    const data = (await this._ipfs.dag.put(proof)).toBaseEncodedString()
    const link = {
      type: 'address-link',
      data
    }
    await this._rootStore.add(link)
  }

  async _readAddressLinks() {
    const entries = await this._rootStore.iterator({ limit: -1 }).collect()
    const linkEntries = entries.filter(e => e.payload.value.type === 'address-link')
    return linkEntries.map(async (entry) => {
      // TODO handle missing ipfs obj??, timeouts?
      const obj = await this._ipfs.dag.get(entry.payload.value.data)
      if (!obj.address) {
        obj.address = utils.recoverPersonalSign(obj.message, obj.signature)
      }
      return obj
    })
  }

  async _readAddressLink(address) {
    const links = await this._readAddressLinks()
    return links.find(link => link.address === address)
  }

  async _ensurePinningNodeConnected (odbAddress, isThread) {
    const roomPeers = await this._ipfs.pubsub.peers(odbAddress)
    if (!roomPeers.find(p => p === this.pinningNode.split('/').pop())) {
      this._ipfs.swarm.connect(this.pinningNode, () => {})
      const rootStoreAddress = this._rootStore.address.toString()
      if (isThread) {
        this._pubsub.publish(PINNING_ROOM, { type: 'SYNC_DB', odbAddress, thread: true })
      } else {
        this._pubsub.publish(PINNING_ROOM, { type: 'PIN_DB', odbAddress: rootStoreAddress })
      }
    }
  }

  async close () {
    await this._orbitdb.stop()
    await this._pubsub.disconnect()
    globalOrbitDB = null
  }

  /**
   * Closes the 3box instance and clears local cache. If you call this,
   * users will need to sign a consent message to log in the next time
   * you call openBox.
   */
  async logout () {
    await this.close()
    this._3id.logout()
    const address = this._3id.managementAddress
    localstorage.remove('linkConsent_' + address)
  }

  /**
   * Check if the given address is logged in
   *
   * @param     {String}    address                 An ethereum address
   * @return    {Boolean}                           true if the user is logged in
   */
  static isLoggedIn (address) {
    return ThreeId.isLoggedIn(address)
  }
}

async function initIPFS (ipfs, iframeStore, ipfsOptions) {
  // if (!ipfs && !ipfsProxy) throw new Error('No IPFS object configured and no default available for environment')
  if (!!ipfs && iframeStore) console.log('Warning: iframeStore true, orbit db cache in iframe, but the given ipfs object is being used, and may not be running in same iframe.')
  if (ipfs) {
    return ipfs
  } else {
    // await iframeLoadedPromise
    // return ipfsProxy
    return new Promise((resolve, reject) => {
      ipfs = new IPFS(ipfsOptions || IPFS_OPTIONS)
      ipfs.on('error', error => {
        console.error(error)
        reject(error)
      })
      ipfs.on('ready', () => resolve(ipfs))
    })
  }
}

Box.idUtils = idUtils

module.exports = Box
