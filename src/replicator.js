const EventEmitter = require('events')
const OrbitDB = require('orbit-db')
const Pubsub = require('orbit-db-pubsub')
const AccessControllers = require('orbit-db-access-controllers')
const registerResolver = require('3id-resolver')
const resolveDID = require('did-resolver').default
const {
  LegacyIPFS3BoxAccessController,
  ThreadAccessController,
  ModeratorAccessController
} = require('3box-orbitdb-plugins')
AccessControllers.addAccessController({ AccessController: LegacyIPFS3BoxAccessController })
AccessControllers.addAccessController({ AccessController: ThreadAccessController })
AccessControllers.addAccessController({ AccessController: ModeratorAccessController })
const config = require('./config')

const PINNING_NODE = config.pinning_node
const PINNING_ROOM = config.pinning_room
const ORBITDB_OPTS = config.orbitdb_options
const ODB_STORE_OPTS = {
  ...ORBITDB_OPTS,
  accessController: {
    type: 'legacy-ipfs-3box',
    skipManifest: true
  }
}
const rootEntryTypes = {
  SPACE: 'space',
  ADDRESS_LINK: 'address-link',
  AUTH_DATA: 'auth-data'
}

const pinDID = did => {
  if (!did) return
  // We resolve the DID in order to pin the ipfs object
  try {
    resolveDID(did)
    // if this throws it's not a DID
  } catch (e) {}
}

class Replicator {
  constructor (ipfs, opts) {
    this.events = new EventEmitter()
    this.ipfs = ipfs
    this._pinningNode = opts.pinningNode || PINNING_NODE
    this.ipfs.swarm.connect(this._pinningNode, () => {})
    this._stores = {}
    this._isSynced = {}
    this._hasPubsubMsgs = {}
    this.events.on('pinning-room-message', (topic, data) => {
      if (data.type === 'HAS_ENTRIES' && data.odbAddress) {
        const odbAddress = data.odbAddress
        // Before the pinning room filter is created we will keep all has messages
        // in memory. After we only care about the ones that are relevant.
        if (this._pinningRoomFilter && !this._pinningRoomFilter[odbAddress]) return
        this._hasPubsubMsgs[odbAddress] = data
        this.events.emit(`has-${odbAddress}`, data)
      }
    })
    registerResolver(ipfs, { pin: true })
  }

  _initPinningRoomFilter () {
    this._pinningRoomFilter = this.listStoreAddresses()
    // clear out any messages that are not relevant
    for (const odbAddress in this._hasPubsubMsgs) {
      if (!this._pinningRoomFilter.includes(odbAddress)) {
        delete this._hasPubsubMsgs[odbAddress]
      }
    }
  }

  async _init (opts) {
    this._pubsub = new Pubsub(this.ipfs, (await this.ipfs.id()).id)
    this._orbitdb = await OrbitDB.createInstance(this.ipfs, { directory: opts.orbitPath })
    this._pubsub.subscribe(PINNING_ROOM, (topic, data) => {
      console.log('message', topic, data)
      this.events.emit('pinning-room-message', topic, data)
    }, (topic, peer) => {
      console.log('peer', topic, peer)
      this.events.emit('pinning-room-peer', topic, peer)
    })
  }

  static async create (ipfs, opts = {}) {
    const replicator = new Replicator(ipfs, opts)
    await replicator._init(opts)
    return replicator
  }

  async start (rootstoreAddress, opts = {}) {
    this._publishDB({ rootstoreAddress })

    this.rootstore = await this._orbitdb.feed(rootstoreAddress, ODB_STORE_OPTS)
    await this.rootstore.load()
    const waitForSync = async () => {
      this.rootstoreSyncDone = this.syncDB(this.rootstore)
      await this.rootstoreSyncDone
      const addressLinkPinPromise = this.getAddressLinks()
      const authDataPinPromise = this.getAuthData()
      this._initPinningRoomFilter()
      await this._loadStores(opts)
      await Promise.all(this._stores.map(store => this.syncDB(store)))
      await addressLinkPinPromise
      await authDataPinPromise
    }
    this.syncDone = waitForSync()
  }

  async new (rootstoreName, pubkey, did) {
    if (this.rootstore) throw new Error('This method can only be called once before the replicator has started')
    const opts = {
      ...ODB_STORE_OPTS,
      format: 'dag-pb'
    }
    opts.accessController.write = [pubkey]
    this.rootstore = await this._orbitdb.feed(rootstoreName, opts)
    this._pinningRoomFilter = []
    this._publishDB({ rootstoreAddress: this.rootstore.address.toString(), did })
    this.rootstoreSyncDone = Promise.resolve()
    this.syncDone = Promise.resolve()
  }

  async stop () {
    await this._orbitdb.stop()
    await this._pubsub.disconnect()
  }

  async addKVStore (name, pubkey, isSpace, did) {
    if (this.rootstore) throw new Error('This method can only be called once before the replicator has started')
    const opts = {
      ...ODB_STORE_OPTS,
      format: 'dag-pb'
    }
    opts.accessController.write = [pubkey]
    const store = await this._orbitdb.keyvalue(name, opts)
    const storeAddress = store.address.toString()
    this._stores[storeAddress] = store
    // add entry to rootstore
    await this.rootstoreSyncDone
    const entries = await this.rootStore.iterator({ limit: -1 }).collect()
    const entry = entries.find(entry => entry.payload.value.odbAddress === storeAddress)
    if (isSpace) {
      if (!entry) {
        await this.rootStore.add({ type: rootEntryTypes.SPACE, DID: did, odbAddress: storeAddress })
      } else if (!entry.payload.value.type) {
        await this.rootStore.del(entry.hash)
        await this.rootStore.add({ type: rootEntryTypes.SPACE, DID: did, odbAddress: storeAddress })
      }
    } else if (!entry) {
      await this.rootStore.add({ odbAddress: storeAddress })
    }
    return store
  }

  _requireRootstoreSynced () {
    if (!this._rootstoreSynced) throw new Error('rootstore must be synced before calling this method')
  }

  async _loadStores ({ profile, allSpaces, spacesList }) {
    const storeEntries = this._listStoreEntries()
    const loadPromises = storeEntries.map(entry => {
      const data = entry.payload.value
      if (data.type === rootEntryTypes.SPACE && data.DID) {
        pinDID(data.DID)
      }
      if (OrbitDB.isValidAddress(data.odbAddress)) {
        if (profile && (data.odbAddress.includes('public') || data.odbAddress.includes('private'))) {
          return this._loadKeyValueStore(data.odbAddress)
        } else if (data.odbAddress.includes(rootEntryTypes.SPACE) && (allSpaces || spacesList.includes(data.odbAddress.split('.')[2]))) {
          return this._loadKeyValueStore(data.odbAddress)
        }
      }
    })
    return Promise.all(loadPromises)
  }

  async _loadKeyValueStore (odbAddress) {
    const store = await this._orbitdb.keyvalue(odbAddress)
    await store.load()
    this._stores[odbAddress] = store
  }

  async getStore (odbAddress) {
    this._requireRootstoreSynced()
    return this._stores[odbAddress] || this._loadKeyValueStore(odbAddress)
  }

  listStoreAddresses () {
    this._requireRootstoreSynced()
    return this._listStoreEntries().map(entry => entry.payload.value.odbAddress)
  }

  _listStoreEntries () {
    const entries = this.rootstore.iterator({ limit: -1 }).collect().filter(e => Boolean(e.payload.value.odbAddress))
    const uniqueEntries = entries.filter((e1, i, a) => {
      return a.findIndex(e2 => e2.payload.value.odbAddress === e1.payload.value.odbAddress) === i
    })
    return uniqueEntries
  }

  async getAddressLinks () {
    const entries = await this.rootStore.iterator({ limit: -1 }).collect()
    const linkEntries = entries.filter(e => e.payload.value.type === rootEntryTypes.ADDRESS_LINK)
    const resolveLinks = linkEntries.map(async entry => {
      const cid = entry.payload.value.data
      // TODO handle missing ipfs obj??, timeouts?
      const obj = (await this.ipfs.dag.get(cid)).value
      this.ipfs.pin.add(cid)
      obj.entry = entry
      return obj
    })
    return Promise.all(resolveLinks)
  }

  async getAuthData () {
    const entries = await this.rootStore.iterator({ limit: -1 }).collect()
    const authEntries = entries.filter(e => e.payload.value.type === rootEntryTypes.AUTH_DATA)
    const resolveLinks = authEntries.map(async entry => {
      const cid = entry.payload.value.data
      // TODO handle missing ipfs obj??, timeouts?
      const obj = (await this.ipfs.dag.get(cid)).value
      this.ipfs.pin.add(cid)
      obj.entry = entry
      return obj
    })
    return Promise.all(resolveLinks)
  }

  async ensureConnected (odbAddress) {
    const isThread = odbAddress.includes('thread')
    const roomPeers = await this.ipfs.pubsub.peers(odbAddress)
    if (!roomPeers.find(p => p === this._pinningNode.split('/').pop())) {
      this.ipfs.swarm.connect(this._pinningNode, () => {})
      const rootstoreAddress = this.rootStore.address.toString()
      if (isThread) {
        this._pubsub.publish(PINNING_ROOM, { type: 'SYNC_DB', odbAddress, thread: true })
      } else {
        this._pubsub.publish(PINNING_ROOM, { type: 'PIN_DB', odbAddress: rootstoreAddress })
      }
    }
  }

  async _publishDB ({ rootstoreAddress, did }) {
    rootstoreAddress = rootstoreAddress || this.rootstore.address.toString()
    // make sure that the pinning node is in the pubsub room before publishing
    const pinningNodeJoined = new Promise((resolve, reject) => {
      this.events.on('pinning-room-peer', (topic, peer) => {
        if (peer === this._pinningNode.split('/').pop()) {
          resolve()
        }
      })
    })
    if (!(await this.ipfs.pubsub.peers(PINNING_ROOM)).includes(this._pinningNode)) {
      await pinningNodeJoined
    }
    this._pubsub.publish(PINNING_ROOM, {
      type: 'PIN_DB',
      odbAddress: rootstoreAddress,
      did
    })
    this.events.removeAllListeners('pinning-room-peer')
  }

  async _getNumEntries (odbAddress) {
    return new Promise((resolve, reject) => {
      const eventName = `has-${odbAddress}`
      this.events.on(eventName, data => {
        this.events.removeAllListeners(eventName)
        resolve(data.numEntries)
      })
      if (this._hasPubsubMsgs[odbAddress]) {
        this.events.removeAllListeners(eventName)
        resolve(this._hasPubsubMsgs[odbAddress].numEntries)
      }
    })
  }

  async syncDB (dbInstance) {
    const numRemoteEntries = await this._getNumEntries(dbInstance.address.toString())
    const isNumber = typeof numRemoteEntries === 'number'
    if (isNumber && numRemoteEntries <= dbInstance._oplog.values.length) return Promise.resolve()
    await new Promise((resolve, reject) => {
      dbInstance.events.on('replicated', () => {
        if (numRemoteEntries <= dbInstance._oplog.values.length) {
          resolve()
          dbInstance.events.removeAllListeners('replicated')
        }
      })
    })
  }
}

module.exports = Replicator
