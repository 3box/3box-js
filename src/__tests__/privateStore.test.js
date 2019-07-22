const utils = require('./testUtils')
const PrivateStore = require('../privateStore')

const STORE_NAME = '09ab7cd93f9e.private'
const emptyEnsureConn = () => {}

jest.mock('../keyValueStore')

describe('PrivateStore', () => {
  let privateStore
  let encryptedSalt

  let threeIdMock = {
    encrypt: cleartext => {
      return {
        nonce: 'asd9hfg0847h',
        ciphertext: `such encrypted, wow!${cleartext}`
      }
    },
    decrypt: ({ciphertext, nonce}) => ciphertext.split('!')[1],
    hashDBKey: key => `${key}f97f0d1ced93052700d740e23666ad9ff8b32366e3ce28696d3c9684f448142e`
  }

  beforeAll(async () => {
    privateStore = new PrivateStore('orbitdb instance', STORE_NAME, emptyEnsureConn, threeIdMock)
  })

  it('should encrypt and decrypt correctly', async () => {
    const value = 'my super secret string'
    const encrypted = await privateStore._encryptEntry(value)
    const decrypted = await privateStore._decryptEntry(encrypted)
    expect(decrypted).toEqual(value)
  })

  it('should throw if not synced', async () => {
    expect(privateStore.set('key', 'value')).rejects.toThrow(/_load must/)
    expect(privateStore.get('key')).rejects.toThrow(/_load must/)
    expect(privateStore.remove('key')).rejects.toThrow(/_load must/)
  })

  it('should set values correctly', async () => {
    await privateStore._load()
    await privateStore.set('key1', 'value1')
    let dbkey = threeIdMock.hashDBKey('key1')
    let retreived = privateStore._db.get(dbkey)
    expect(await privateStore._decryptEntry(retreived)).toEqual('value1')

    await privateStore.set('key2', 'lalalla')
    dbkey = threeIdMock.hashDBKey('key2')
    retreived = privateStore._db.get(dbkey)
    expect(await privateStore._decryptEntry(retreived)).toEqual('lalalla')

    await privateStore.set('key3', '12345')
    dbkey = threeIdMock.hashDBKey('key3')
    retreived = privateStore._db.get(dbkey)
    expect(await privateStore._decryptEntry(retreived)).toEqual('12345')
  })

  it('should set multiple values correctly', async () => {
    await privateStore._load()
    await privateStore.setMultiple(['key4', 'key5'], ['yoyo', 'ma'])
    let dbkey = threeIdMock.hashDBKey('key4')
    let retreived = privateStore._db.get(dbkey)
    expect(await privateStore._decryptEntry(retreived)).toEqual('yoyo')
    dbkey = threeIdMock.hashDBKey('key5')
    retreived = privateStore._db.get(dbkey)
    expect(await privateStore._decryptEntry(retreived)).toEqual('ma')
  })

  it('should get values correctly', async () => {
    let value = await privateStore.get('key1')
    expect(value).toEqual('value1')

    value = await privateStore.get('key2')
    expect(value).toEqual('lalalla')

    value = await privateStore.get('key3')
    expect(value).toEqual('12345')

    value = await privateStore.get('key4')
    expect(value).toEqual('yoyo')

    value = await privateStore.get('key5')
    expect(value).toEqual('ma')
  })

  it('should get value with metadata correctly', async () => {
    await privateStore.set('key6', 'meta')
    const response = await privateStore.get('key6', { metadata: true })

    expect(response.value).toEqual('meta')
    expect(response.timestamp).toBeGreaterThan(0)
  })

  it('should get null when key does not exist', async () => {
    const response = await privateStore.get('nonexisting', { metadata: true })

    expect(response).toBeNull()
  })

  it('should remove values correctly', async () => {
    await privateStore.remove('key3')
    expect(await privateStore.get('key3')).toBeNull()
    await privateStore.remove('key2')
    expect(await privateStore.get('key2')).toBeNull()
  })

  it('should throw if key not given', async () => {
    await expect(privateStore.set()).rejects.toEqual(new Error('key is a required argument'))
    await expect(privateStore.remove()).rejects.toEqual(new Error('key is a required argument'))
  })

  describe('log', () => {

    beforeEach(async () => {
      privateStore = new PrivateStore('orbitdb instance', STORE_NAME, emptyEnsureConn, threeIdMock)
      const storeAddr = await privateStore._load()
      await privateStore.set('key1', 'value1')
    })

    it('should return array of ALL entries values of log underlying store decrypted', async () => {
      const log = await privateStore.log()
      const entry = log.pop()
      expect(entry.key).toEqual('key1f97f0d1ced93052700d740e23666ad9ff8b32366e3ce28696d3c9684f448142e')
      expect(entry.value).toEqual('value1')
    })
  })
})
