const utils = require('./testUtils')
const KeyValueStore = require('../keyValueStore')
const OrbitDB = require('orbit-db')

const STORE_NAME = '09ab7cd93f9e.public'

describe('KeyValueStore', () => {
  let ipfs
  let orbitdb
  let keyValueStore
  let storeAddr
  jest.setTimeout(20000)

  beforeAll(async () => {
    ipfs = await utils.initIPFS()
    orbitdb = new OrbitDB(ipfs, './tmp/orbitdb1')
    keyValueStore = new KeyValueStore(orbitdb, STORE_NAME)
  })

  it('should throw if not synced', async () => {
    expect(keyValueStore.set('key', 'value')).rejects.toThrow(/_sync must/)
    expect(keyValueStore.get('key')).rejects.toThrow(/_sync must/)
    expect(keyValueStore.remove('key')).rejects.toThrow(/_sync must/)
  })

  it('should start with an empty db on first sync', async () => {
    storeAddr = await keyValueStore._sync()
    expect(storeAddr.split('/')[3]).toEqual(STORE_NAME)
    expect(keyValueStore._db.all()).toEqual({})
  })

  it('should set and get values correctly', async () => {
    await keyValueStore.set('key1', 'value1')
    expect(await keyValueStore.get('key1')).toEqual('value1')

    await keyValueStore.set('key2', 'lalalla')
    expect(await keyValueStore.get('key2')).toEqual('lalalla')

    await keyValueStore.set('key3', '12345')
    expect(await keyValueStore.get('key3')).toEqual('12345')
  })

  it('should remove values correctly', async () => {
    await keyValueStore.remove('key3')
    expect(await keyValueStore.get('key3')).toBeUndefined()
    await keyValueStore.remove('key2')
    expect(await keyValueStore.get('key2')).toBeUndefined()
  })

  it('should sync an old profile correctly', async () => {
    let ipfs2 = await utils.initIPFS(true)
    let orbitdb2 = new OrbitDB(ipfs2, './tmp/orbitdb2')
    let keyValueStore2 = new KeyValueStore(orbitdb2, STORE_NAME)
    let newAddr = await keyValueStore2._sync(storeAddr)

    expect(newAddr).toEqual(storeAddr)
    expect(await keyValueStore2.get('key1')).toEqual('value1')
    expect(await keyValueStore2.get('key2')).toBeUndefined()
    expect(await keyValueStore2.get('key3')).toBeUndefined()
    await orbitdb2.stop()
    await ipfs2.stop()
  })

  describe('log', () => {

    beforeEach(async () => {
      keyValueStore = new KeyValueStore(orbitdb, STORE_NAME)
      storeAddr = await keyValueStore._sync()
      await keyValueStore.set('key1', 'value1')
      await keyValueStore.set('key2', 'lalalla')
      await keyValueStore.set('key3', '12345')
    })

    it('should return array of ALL entries ({op: .., key: .., value: .., timeStamp: ..}) of log underlying store ', async () => {
      const log = keyValueStore.log
      expect(log.length).toEqual(3)
      const entry = log[0]
      expect(Object.keys(entry).sort()).toEqual(['key', 'op', 'timeStamp', 'value'])
    })

    it('should be time ordered', async () => {
      const log = keyValueStore.log
      expect(log[0].key).toEqual('key1')
      expect(log[1].key).toEqual('key2')
      expect(log[2].key).toEqual('key3')
    })

    it('should including ALL entries, including OPS on same keys', async () => {
      // write over existing key
      await keyValueStore.set('key3', '6789')
      const log = keyValueStore.log
      expect(log[2].key).toEqual('key3')
      expect(log[3].key).toEqual('key3')
      expect(log[2].value).toEqual('12345')
      expect(log[3].value).toEqual('6789')
    })

    it('should including ALL entries, including DEL ops', async () => {
      await keyValueStore.remove('key1')
      const log = keyValueStore.log
      expect(log.length).toEqual(4)
      const lastEntry = log.pop()
      expect(lastEntry.key).toEqual('key1')
      expect(lastEntry.op).toEqual('DEL')
      expect(lastEntry.value).toBeNull()
    })
  })

  afterAll(async () => {
    await orbitdb.stop()
    await ipfs.stop()
  })
})
