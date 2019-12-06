const EventEmitter = require('events')
const OrbitDB = require('orbit-db')
const Pubsub = require('orbit-db-pubsub')
const AccessControllers = require('orbit-db-access-controllers')
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
const entryTypes = {
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
    this._storePromises = {}
    // TODO - this should only be done in 3box-js. For use in
    // 3box-pinning-node the below code should be disabled
    this._hasPubsubMsgs = {}
    this.events.on('pinning-room-message', (topic, data) => {
      if (data.type === 'HAS_ENTRIES' && data.odbAddress) {
        const odbAddress = data.odbAddress
        if (this._pinningRoomFilter) {
          const hasMsgFor = Object.keys(this._hasPubsubMsgs)
          if (this._pinningRoomFilter.length <= hasMsgFor.length) {
            const haveAllMsgs = this._pinningRoomFilter.reduce((acc, addr) => acc && hasMsgFor.includes(addr), true)
            if (haveAllMsgs) {
              this._pubsub.unsubscribe(PINNING_ROOM)
            }
          }
          // Before the pinning room filter is created we will keep all has messages
          // in memory. After we only care about the ones that are relevant.
          if (!this._pinningRoomFilter.includes(odbAddress)) {
            return
          }
        }
        this._hasPubsubMsgs[odbAddress] = data
        this.events.emit(`has-${odbAddress}`, data)
      }
    })
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
  }

  async _joinPinningRoom (firstJoin) {
    if (!firstJoin && (await this.ipfs.pubsub.ls()).includes(PINNING_ROOM)) return
    this._pubsub.subscribe(PINNING_ROOM, (topic, data) => {
      // console.log('message', topic, data)
      this.events.emit('pinning-room-message', topic, data)
    }, (topic, peer) => {
      // console.log('peer', topic, peer)
      this.events.emit('pinning-room-peer', topic, peer)
    })
  }

  static async create (ipfs, opts = {}) {
    const replicator = new Replicator(ipfs, opts)
    await replicator._init(opts)
    return replicator
  }

  async start (rootstoreAddress, opts = {}) {
    await this._joinPinningRoom(true)
    this._publishDB({ odbAddress: rootstoreAddress })

    this.rootstore = await this._orbitdb.feed(rootstoreAddress, ODB_STORE_OPTS)
    await this.rootstore.load()
    this.rootstoreSyncDone = this.syncDB(this.rootstore)
    const waitForSync = async () => {
      await this.rootstoreSyncDone
      const addressLinkPinPromise = this.getAddressLinks()
      const authDataPinPromise = this.getAuthData()
      this._initPinningRoomFilter()
      await this._loadStores(opts)
      await Promise.all(Object.keys(this._stores).map(addr => this.syncDB(this._stores[addr])))
      await addressLinkPinPromise
      await authDataPinPromise
    }
    this.syncDone = waitForSync()
  }

  async new (rootstoreName, pubkey, did, muportDID) {
    if (this.rootstore) throw new Error('This method can only be called once before the replicator has started')
    await this._joinPinningRoom(true)
    const opts = {
      ...ODB_STORE_OPTS,
      format: 'dag-pb'
    }
    opts.accessController.write = [pubkey]
    this.rootstore = await this._orbitdb.feed(rootstoreName, opts)
    this._pinningRoomFilter = []
    this._publishDB({ odbAddress: this.rootstore.address.toString(), did, muportDID })
    await this.rootstore.load()
    this.rootstoreSyncDone = Promise.resolve()
    this.syncDone = Promise.resolve()
  }

  async stop () {
    await this._orbitdb.stop()
    await this._pubsub.disconnect()
  }

  async addKVStore (name, pubkey, isSpace, did) {
    if (!this.rootstore) throw new Error('This method can only be called once before the replicator has started')
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
    const entries = await this.rootstore.iterator({ limit: -1 }).collect()
    const entry = entries.find(entry => entry.payload.value.odbAddress === storeAddress)
    if (isSpace) {
      if (!entry) {
        await this.rootstore.add({ type: entryTypes.SPACE, DID: did, odbAddress: storeAddress })
      } else if (!entry.payload.value.type) {
        await this.rootstore.del(entry.hash)
        await this.rootstore.add({ type: entryTypes.SPACE, DID: did, odbAddress: storeAddress })
      }
    } else if (!entry) {
      await this.rootstore.add({ odbAddress: storeAddress })
    }
    if (!this._hasPubsubMsgs[storeAddress]) {
      this._hasPubsubMsgs[storeAddress] = { numEntries: 0 }
    }
    return store
  }

  async _loadStores ({ profile, allSpaces, spacesList }) {
    const storeEntries = this._listStoreEntries()
    const loadPromises = storeEntries.map(entry => {
      const data = entry.payload.value
      if (data.type === entryTypes.SPACE && data.DID) {
        pinDID(data.DID)
      }
      if (profile && (data.odbAddress.includes('public') || data.odbAddress.includes('private'))) {
        return this._loadKeyValueStore(data.odbAddress)
      } else if (data.odbAddress.includes(entryTypes.SPACE) &&
        (allSpaces || (spacesList && spacesList.includes(data.odbAddress.split('.')[2])))) {
        return this._loadKeyValueStore(data.odbAddress)
      }
    })
    return Promise.all(loadPromises)
  }

  async _loadKeyValueStore (odbAddress) {
    if (!this._storePromises[odbAddress]) {
      this._storePromises[odbAddress] = new Promise((resolve, reject) => {
        this._orbitdb.keyvalue(odbAddress, ODB_STORE_OPTS).then(store => {
          store.load().then(() => { resolve(store) })
        })
      })
    }
    this._stores[odbAddress] = await this._storePromises[odbAddress]
    return this._stores[odbAddress]
  }

  async getStore (odbAddress) {
    return this._stores[odbAddress] || this._loadKeyValueStore(odbAddress)
  }

  listStoreAddresses () {
    return this._listStoreEntries().map(entry => entry.payload.value.odbAddress)
  }

  _listStoreEntries () {
    const entries = this.rootstore.iterator({ limit: -1 }).collect().filter(e => OrbitDB.isValidAddress(e.payload.value.odbAddress || ''))
    const uniqueEntries = entries.filter((e1, i, a) => {
      return a.findIndex(e2 => e2.payload.value.odbAddress === e1.payload.value.odbAddress) === i
    })
    return uniqueEntries
  }

  async getAddressLinks () {
    const entries = await this.rootstore.iterator({ limit: -1 }).collect()
    const linkEntries = entries.filter(e => e.payload.value.type === entryTypes.ADDRESS_LINK)
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
    const entries = await this.rootstore.iterator({ limit: -1 }).collect()
    const authEntries = entries.filter(e => e.payload.value.type === entryTypes.AUTH_DATA)
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

  get _pinningNodePeerId () {
    return this._pinningNode.split('/').pop()
  }

  async ensureConnected (odbAddress) {
    const isThread = odbAddress.includes('thread')
    const roomPeers = await this.ipfs.pubsub.peers(odbAddress)
    if (!roomPeers.find(p => p === this._pinningNodePeerId)) {
      this.ipfs.swarm.connect(this._pinningNode, () => {})
      odbAddress = isThread ? odbAddress : this.rootstore.address.toString()
      this._publishDB({ odbAddress, isThread }, true)
    }
  }

  async _publishDB ({ odbAddress, did, muportDID, isThread }, unsubscribe) {
    this._joinPinningRoom()
    odbAddress = odbAddress || this.rootstore.address.toString()
    // make sure that the pinning node is in the pubsub room before publishing
    const pinningNodeJoined = new Promise((resolve, reject) => {
      this.events.on('pinning-room-peer', (topic, peer) => {
        if (peer === this._pinningNodePeerId) {
          resolve()
        }
      })
    })
    if (!(await this.ipfs.pubsub.peers(PINNING_ROOM)).includes(this._pinningNodePeerId)) {
      await pinningNodeJoined
    }
    this._pubsub.publish(PINNING_ROOM, {
      type: isThread ? 'SYNC_DB' : 'PIN_DB',
      odbAddress,
      did,
      muportDID,
      thread: isThread
    })
    this.events.removeAllListeners('pinning-room-peer')
    if (unsubscribe) {
      this._pubsub.unsubscribe(PINNING_ROOM)
    }
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
    // TODO - syncDB is only relevant in 3box-js. Some different logic
    // is needed for syncing in 3box-pinning-node
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

  static get entryTypes () {
    return entryTypes
  }
}

module.exports = Replicator
