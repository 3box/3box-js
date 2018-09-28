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

  afterAll(async () => {
    await orbitdb.stop()
    await ipfs.stop()
  })
})
