const testUtils = require('./testUtils')
const Replicator = require('../replicator')
const { threeIDMockFactory, didResolverMock } = require('../__mocks__/3ID')
const Pubsub = require('orbit-db-pubsub')
const { registerMethod } = require('did-resolver')

const testDID = 'did:3:bafoijqr94'
const PINNING_ROOM = '3box-pinning'

describe('Replicator', () => {
  jest.setTimeout(30000)
  let ipfs1, ipfs2, ipfs1MultiAddr, ipfs2MultiAddr
  let pubsub1, pubsub2, threeId
  let replicator1, replicator2

  beforeAll(async () => {
    ipfs1 = await testUtils.initIPFS(7)
    ipfs2 = await testUtils.initIPFS(8)
    ipfs1MultiAddr = (await ipfs1.id()).addresses[0]
    ipfs2MultiAddr = (await ipfs2.id()).addresses[0]
    // pubsub1 = new Pubsub(ipfs1, (await ipfs1.id()).id)
    pubsub2 = new Pubsub(ipfs2, (await ipfs2.id()).id)
    threeId = threeIDMockFactory(testDID)
  })

  afterAll(async () => {
    await replicator1.close()
    await replicator2.close()
    await pubsub2.disconnect()
    await testUtils.stopIPFS(ipfs1, 7)
    await testUtils.stopIPFS(ipfs2, 8)
  })

  it('creates replicator correctly', async () => {
    const opts = {
      pinningNode: ipfs2MultiAddr,
      orbitPath: './tmp/orbitdb13',
    }
    replicator1 = await Replicator.create(ipfs1, opts)
    registerMethod('3', didResolverMock)
  })

  it('new rootstore created', async () => {
    const rsName = 'rsName.root'
    const key = threeId.getPublicKeys().signingKey

    const publishPromise = new Promise((resolve, reject) => {
      pubsub2.subscribe(PINNING_ROOM, (topic, data) => {
        expect(data.odbAddress).toMatchSnapshot()
        resolve()
      }, () => {})
    })

    await replicator1.new(rsName, key, testDID)
    await replicator1.rootstoreSyncDone
    await replicator1.syncDone
    expect(replicator1.rootstore.address.toString()).toMatchSnapshot()
    await publishPromise
    await pubsub2.unsubscribe(PINNING_ROOM)

    expect(await replicator1.ipfs.pubsub.ls()).toMatchSnapshot()
    expect((await replicator1.ipfs.swarm.peers()).map(p => p.peer._idB58String)).toContain(ipfs2MultiAddr.split('/').pop())
  })

  it('adds profile KVStore correctly', async () => {
    const storeName = 'profile.public'
    const key = threeId.getPublicKeys().signingKey
    replicator1.rootstore.setIdentity(await threeId.getOdbId())
    await replicator1.addKVStore(storeName, key, false, testDID)
    expect(replicator1.listStoreAddresses()).toMatchSnapshot()
    expect(Object.keys(replicator1._stores)).toMatchSnapshot()
    // should not re-add entry
    await replicator1.addKVStore(storeName, key, false, testDID)
    expect(replicator1.listStoreAddresses()).toMatchSnapshot()
  })

  it('adds space KVStore correctly', async () => {
    const storeName = `3box.space.namey.keyvalue`
    const key = threeId.getPublicKeys().signingKey
    await replicator1.addKVStore(storeName, key, true, testDID)
    expect(replicator1.listStoreAddresses()).toMatchSnapshot()
    expect(Object.keys(replicator1._stores)).toMatchSnapshot()
    // should not re-add entry
    await replicator1.addKVStore(storeName, key, true, testDID)
    expect(replicator1.listStoreAddresses()).toMatchSnapshot()
  })

  it('replicates 3box on start, without stores', async () => {
    const opts = {
      pinningNode: ipfs1MultiAddr,
      orbitPath: './tmp/orbitdb14',
    }
    replicator2 = await Replicator.create(ipfs2, opts)
    registerMethod('3', didResolverMock)
    const rootstoreAddress = replicator1.rootstore.address.toString()
    const rootstoreNumEntries = replicator1.rootstore._oplog._length
    await replicator2.start(rootstoreAddress)
    replicator1._pubsub.publish(PINNING_ROOM, { type: 'HAS_ENTRIES', odbAddress: rootstoreAddress, numEntries: rootstoreNumEntries })
    await replicator2.rootstoreSyncDone
    await replicator2.syncDone

    expect((await replicator2.ipfs.pubsub.ls())[0]).toMatchSnapshot()
    expect((await replicator2.ipfs.swarm.peers()).map(p => p.peer._idB58String)).toContain(ipfs1MultiAddr.split('/').pop())

    expect(replicator2.listStoreAddresses()).toEqual(replicator1.listStoreAddresses())
    expect(replicator2.rootstore.iterator({ limit: -1 }).collect()).toEqual(replicator1.rootstore.iterator({ limit: -1 }).collect())
    expect(replicator2._stores).toEqual({})
    await replicator2.stop()
  })

  it('replicates 3box on start, with profile', async () => {
    let pubStoreAddr = replicator1.listStoreAddresses()[0]
    const addProfilePromise = (async () => {
      const pubStore = await replicator1.getStore(pubStoreAddr)
      pubStore.setIdentity(await threeId.getOdbId())
      await pubStore.set('name', 'asdfasdf')
      await pubStore.set('emoji', ';P')
    })()
    const opts = {
      pinningNode: ipfs1MultiAddr,
      orbitPath: './tmp/orbitdb14',
    }
    replicator2 = await Replicator.create(ipfs2, opts)
    registerMethod('3', didResolverMock)
    const rootstoreAddress = replicator1.rootstore.address.toString()
    const rootstoreNumEntries = replicator1.rootstore._oplog._length
    await addProfilePromise
    const pubStoreNumEntries = replicator1._stores[pubStoreAddr]._oplog._length
    await replicator2.start(rootstoreAddress, { profile: true })
    replicator1._pubsub.publish(PINNING_ROOM, { type: 'HAS_ENTRIES', odbAddress: rootstoreAddress, numEntries: rootstoreNumEntries })
    replicator1._pubsub.publish(PINNING_ROOM, { type: 'HAS_ENTRIES', odbAddress: pubStoreAddr, numEntries: pubStoreNumEntries })
    await replicator2.rootstoreSyncDone
    await replicator2.syncDone
    expect(replicator2._stores[pubStoreAddr]).toBeDefined()
    expect(replicator2._stores[pubStoreAddr].all).toMatchSnapshot()
    await replicator2.stop()
  })

  const addEntry = async (type, data) => {
    const cid = (await ipfs1.dag.put(data)).toBaseEncodedString()
    await replicator1.rootstore.add({ type, data: cid })
    return cid
  }

  it('getAddressLinks returns correct entries and pins data', async () => {
    const cid1 = await addEntry('address-link', { much: 'data' })
    const cid2 = await addEntry('address-link', { more: 'bits' })
    const entryData = (await replicator1.getAddressLinks()).map(e => {
      delete e.entry
      return e
    })
    expect(entryData).toMatchSnapshot()
    await testUtils.delay(100)
    const pinnedCIDs = (await ipfs1.pin.ls()).map(pin => pin.hash)
    expect(pinnedCIDs.includes(cid1)).toBeTruthy()
    expect(pinnedCIDs.includes(cid2)).toBeTruthy()
  })

  it('getAuthData', async () => {
    const cid1 = await addEntry('auth-data', { ciphertext: 'onezero' })
    const cid2 = await addEntry('auth-data', { ciphertext: 'bits' })
    const entryData = (await replicator1.getAuthData()).map(e => {
      delete e.entry
      return e
    })
    expect(entryData).toMatchSnapshot()
    await testUtils.delay(100)
    const pinnedCIDs = (await ipfs1.pin.ls()).map(pin => pin.hash)
    expect(pinnedCIDs.includes(cid1)).toBeTruthy()
    expect(pinnedCIDs.includes(cid2)).toBeTruthy()
  })

  it('pinningRoomFilter works as expected', async () => {
    await new Promise((resolve, reject) => pubsub2.subscribe(PINNING_ROOM, () => {}, resolve))
    replicator1._hasPubsubMsgs = {}
    replicator1._pinningRoomFilter = null
    pubsub2.publish(PINNING_ROOM, { type: 'HAS_ENTRIES', odbAddress: 'fake address 1'})
    pubsub2.publish(PINNING_ROOM, { type: 'HAS_ENTRIES', odbAddress: 'fake address 2'})
    pubsub2.publish(PINNING_ROOM, { type: 'HAS_ENTRIES', odbAddress: 'fake address 3'})
    pubsub2.publish(PINNING_ROOM, { type: 'HAS_ENTRIES', odbAddress: 'fake address 4'})
    await testUtils.delay(200)
    replicator1._pinningRoomFilter = ['fake address 6', 'fake address 7']
    pubsub2.publish(PINNING_ROOM, { type: 'HAS_ENTRIES', odbAddress: 'fake address 5'})
    pubsub2.publish(PINNING_ROOM, { type: 'HAS_ENTRIES', odbAddress: 'fake address 6'})
    pubsub2.publish(PINNING_ROOM, { type: 'HAS_ENTRIES', odbAddress: 'fake address 7'})
    pubsub2.publish(PINNING_ROOM, { type: 'HAS_ENTRIES', odbAddress: 'fake address 8'})
    await testUtils.delay(200)
    expect(Object.keys(replicator1._hasPubsubMsgs).length).toEqual(6)
    await pubsub2.unsubscribe(PINNING_ROOM)
    replicator1._pinningRoomFilter = []
  })

  it('ensureConnected works as expected for store', async () => {
    let peer = (await ipfs2.swarm.addrs())[0]
    await ipfs2.swarm.disconnect(peer)
    await testUtils.delay(1000)
    await replicator1.ensureConnected('fake address store')
    await new Promise((resolve, reject) => {
      pubsub2.subscribe(PINNING_ROOM, (topic, data) => {
        expect(data).toMatchSnapshot()
        resolve()
      }, () => {})
    })
    pubsub2.unsubscribe(PINNING_ROOM)
  })

  it('ensureConnected works as expected for thread', async () => {
    let peer = (await ipfs2.swarm.addrs())[0]
    await ipfs2.swarm.disconnect(peer)
    await testUtils.delay(1000)
    await replicator1.ensureConnected('fake address thread')
    await new Promise((resolve, reject) => {
      pubsub2.subscribe(PINNING_ROOM, (topic, data) => {
        expect(data).toMatchSnapshot()
        resolve()
      }, () => {})
    })
    pubsub2.unsubscribe(PINNING_ROOM)
  })
})
