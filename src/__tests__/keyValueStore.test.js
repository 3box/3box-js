const utils = require('./testUtils')
const KeyValueStore = require('../keyValueStore')
const OrbitDB = require('orbit-db')
const { OdbIdentityProvider, LegacyIPFS3BoxAccessController } = require('3box-orbitdb-plugins')
const Identities = require('orbit-db-identity-provider')
Identities.addIdentityProvider(OdbIdentityProvider)
const AccessControllers = require('orbit-db-access-controllers')
AccessControllers.addAccessController({ AccessController: LegacyIPFS3BoxAccessController })
const { registerMethod } = require('did-resolver')
const { threeIDMockFactory, didResolverMock } = require('../__mocks__/3ID')

const STORE_NAME = '09ab7cd93f9e.public'
const DID1 = 'did:3:zdpuAsaK9YsqpphSBeQvfrKAjs8kF7vUX4Y3kMkMRgEQigzCt'
const THREEID_MOCK = threeIDMockFactory(DID1)

const config = require('../config')
const ORBITDB_OPTS = config.orbitdb_options

registerMethod('3', didResolverMock)

describe('KeyValueStore', () => {
  let ipfs
  let orbitdb
  let replicatorMock
  let keyValueStore
  let storeAddr
  jest.setTimeout(20000)

  beforeAll(async () => {
    ipfs = await utils.initIPFS(2)
    orbitdb = await OrbitDB.createInstance(ipfs, {
      directory:'./tmp/orbitdb4',
      identity: await Identities.createIdentity({
        type: '3ID',
        threeId: THREEID_MOCK,
        identityKeysPath: './tmp/odbIdentityKeys'
      })
    })
    const kvstores = []
    let store
    replicatorMock = {
      ensureConnected: jest.fn(),
      syncDB: jest.fn(),
      listStoreAddresses: jest.fn(() => {
        return kvstores
      }),
      getStore: jest.fn(async odbAddress => {
        return store
      }),
      addKVStore: jest.fn(async (name, key, isSpace, did) => {
        const opts = {
          ...ORBITDB_OPTS,
          format: 'dag-pb',
          accessController: {
            write: [key],
            type: 'legacy-ipfs-3box',
            skipManifest: true
          }
        }
        store = await orbitdb.keyvalue(name, opts)
        kvstores.push(store.address.toString())
        return store
      })
    }
    keyValueStore = new KeyValueStore(STORE_NAME, replicatorMock, THREEID_MOCK)
  })

  beforeEach(() => {
    replicatorMock.ensureConnected.mockClear()
    replicatorMock.listStoreAddresses.mockClear()
    replicatorMock.getStore.mockClear()
    replicatorMock.addKVStore.mockClear()
  })

  it('should correctly take 3id at _load', async () => {
    const kvs = new KeyValueStore('tmp', replicatorMock)
    expect(kvs._3id).toBeUndefined()
    await kvs._load(THREEID_MOCK)
    expect(kvs._3id).toEqual(THREEID_MOCK)
    kvs.close()
  })

  it('should throw if not synced', async () => {
    expect(keyValueStore.set('key', 'value')).rejects.toThrow(/_load must/)
    expect(keyValueStore.setMultiple(['keys'], ['values'])).rejects.toThrow(/_load must/)
    expect(keyValueStore.get('key')).rejects.toThrow(/_load must/)
    expect(keyValueStore.remove('key')).rejects.toThrow(/_load must/)
  })

  it('should start with an empty db on load', async () => {
    storeAddr = await keyValueStore._load()
    expect(storeAddr.split('/')[3]).toEqual(STORE_NAME)
    expect(keyValueStore._db.all).toEqual({})
    expect(replicatorMock.listStoreAddresses).toHaveBeenCalledTimes(1)
    expect(replicatorMock.addKVStore).toHaveBeenCalledTimes(1)
    expect(replicatorMock.getStore).toHaveBeenCalledTimes(0)
  })

  it('should start with existing db if in replicator on load', async () => {
    storeAddr = await keyValueStore._load()
    expect(storeAddr.split('/')[3]).toEqual(STORE_NAME)
    expect(keyValueStore._db.all).toEqual({})
    expect(replicatorMock.listStoreAddresses).toHaveBeenCalledTimes(1)
    expect(replicatorMock.addKVStore).toHaveBeenCalledTimes(0)
    expect(replicatorMock.getStore).toHaveBeenCalledTimes(1)
    expect(replicatorMock.getStore).toHaveBeenCalledWith(keyValueStore._db.address.toString())
  })

  it('should set and get values correctly', async () => {
    await keyValueStore.set('key1', 'value1')
    expect(await keyValueStore.get('key1')).toEqual('value1')
    expect(replicatorMock.ensureConnected).toHaveBeenCalledTimes(1)

    await keyValueStore.set('key2', 'lalalla')
    expect(await keyValueStore.get('key2')).toEqual('lalalla')
    expect(replicatorMock.ensureConnected).toHaveBeenCalledTimes(2)

    await keyValueStore.set('key3', '12345')
    expect(await keyValueStore.get('key3')).toEqual('12345')
    expect(replicatorMock.ensureConnected).toHaveBeenCalledTimes(3)
  })

  it('should set and get multiple values correctly', async () => {
    await keyValueStore.setMultiple(['key4', 'key5'], ['yoyo', 'ma'])
    expect(await keyValueStore.get('key4')).toEqual('yoyo')
    expect(await keyValueStore.get('key5')).toEqual('ma')
    expect(replicatorMock.ensureConnected).toHaveBeenCalledTimes(1)
  })

  it('should set and get with metadata correctly', async () => {
    await keyValueStore.set('key6', 'meta')
    const { value, timestamp } = await keyValueStore.get('key6', { metadata: true })
    expect(value).toBe('meta')
    expect(timestamp).toBeGreaterThan(0)
  })

  it('should return null for non existing keys with metadata', async () => {
    expect(await keyValueStore.get('nonkey', { metadata: true })).toBeUndefined()
  })

  it('should get all with metadata', async () => {
    await keyValueStore.setMultiple(['key7', 'key8'], ['hello', 'world'])

    const entries = await keyValueStore.all({ metadata: true })
    let entry = entries['key7']
    expect(entry.value).toBe('hello')
    expect(entry.timestamp).toBeGreaterThan(0)

    entry = entries['key8']
    expect(entry.value).toBe('world')
    expect(entry.timestamp).toBeGreaterThan(0)
  })

  it('should remove values correctly', async () => {
    await keyValueStore.remove('key3')
    expect(await keyValueStore.get('key3')).toBeUndefined()
    expect(replicatorMock.ensureConnected).toHaveBeenCalledTimes(1)
    await keyValueStore.remove('key2')
    expect(await keyValueStore.get('key2')).toBeUndefined()
    expect(replicatorMock.ensureConnected).toHaveBeenCalledTimes(2)
  })

  it('should throw if key not given', async () => {
    expect(keyValueStore.set()).rejects.toEqual(new Error('key is a required argument'))
    expect(keyValueStore.remove()).rejects.toEqual(new Error('key is a required argument'))
  })

  it('should sync an old profile correctly', async () => {
    let ipfs2 = await utils.initIPFS(3)
    let orbitdb2 = await OrbitDB.createInstance(ipfs2, {
      directory:'./tmp/orbitdb2',
    })
    let keyValueStore2 = new KeyValueStore(STORE_NAME, replicatorMock, THREEID_MOCK)
    let newAddr = await keyValueStore2._load()
    expect(newAddr).toEqual(storeAddr)

    let numRemoteEntries = keyValueStore._db._oplog.values.length
    await keyValueStore2._sync(numRemoteEntries)

    expect(await keyValueStore2.get('key1')).toEqual('value1')
    expect(await keyValueStore2.get('key2')).toBeUndefined()
    expect(await keyValueStore2.get('key3')).toBeUndefined()
    await orbitdb2.stop()
    await utils.stopIPFS(ipfs2, 3)
  })

  describe('metdata', () => {
    it('should contain the metadata method', async () => {
      await keyValueStore.set('some-key', 'some-value')

      const v = await keyValueStore.get('some-key')
      const m = await keyValueStore.getMetadata('some-key')

      expect(v).toEqual('some-value')
      expect(m).toBeDefined()
      expect(m.timestamp).toBeDefined()
      expect('' + m.timestamp).toHaveLength(10) // this will break around year 2286
    })

    it('should return an undefined value for unknown key', async () => {
      const m = await keyValueStore.getMetadata('a key so complex no one would set it')
      expect(m).toBeUndefined()
    })
  })

  describe('log', () => {

    let storeNum = 0

    beforeEach(async () => {
      keyValueStore = new KeyValueStore('store num' + storeNum++, replicatorMock, THREEID_MOCK)
      storeAddr = await keyValueStore._load()
      await keyValueStore.set('key1', 'value1')
      await keyValueStore.set('key2', 'lalalla')
      await keyValueStore.set('key3', '12345')
    })

    it('should return array of ALL entries ({op: .., key: .., value: .., timeStamp: ..}) of log underlying store ', async () => {
      const log = await keyValueStore.log()
      expect(log.length).toEqual(3)
      const entry = log[0]
      expect(Object.keys(entry).sort()).toEqual(['key', 'op', 'timeStamp', 'value'])
    })

    it('should be time ordered', async () => {
      const log = await keyValueStore.log()
      expect(log[0].key).toEqual('key1')
      expect(log[1].key).toEqual('key2')
      expect(log[2].key).toEqual('key3')
    })

    it('should including ALL entries, including OPS on same keys', async () => {
      // write over existing key
      await keyValueStore.set('key3', '6789')
      const log = await keyValueStore.log()
      expect(log[2].key).toEqual('key3')
      expect(log[3].key).toEqual('key3')
      expect(log[2].value).toEqual('12345')
      expect(log[3].value).toEqual('6789')
    })

    it('should including ALL entries, including DEL ops', async () => {
      await keyValueStore.remove('key1')
      const log = await keyValueStore.log()
      expect(log.length).toEqual(4)
      const lastEntry = log.pop()
      expect(lastEntry.key).toEqual('key1')
      expect(lastEntry.op).toEqual('DEL')
      expect(lastEntry.value).toBeNull()
    })
  })

  it('should including ALL entries, including DEL ops', async () => {
  })

  afterAll(async () => {
    await orbitdb.stop()
    await utils.stopIPFS(ipfs, 2)
  })
})
