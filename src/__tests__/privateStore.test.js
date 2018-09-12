const utils = require('./testUtils')
const PrivateStore = require('../privateStore')

describe('PrivateStore', () => {
  let ipfsd
  let privateStore

  let muportDIDMock = {
    symEncrypt: cleartext => {
      return {
        nonce: 'asd9hfg0847h',
        ciphertext: 'such encrypted, wow!' + cleartext
      }
    },
    symDecrypt: (ciphertext, nonce) => ciphertext.split('!')[1],
    getDid: () => 'did:muport:Qmsdfwerg'
  }

  let latestRoot = null
  const updateRoot = newRoot => {
    expect(newRoot).not.toEqual(latestRoot)
    latestRoot = newRoot
  }

  beforeAll(async () => {
    ipfsd = await utils.spawnIPFSD()
    privateStore = new PrivateStore(muportDIDMock, ipfsd.api, updateRoot)
  })

  it('should encrypt and decrypt correctly', async () => {
    const value = 'my super secret string'
    const encrypted = privateStore._encryptEntry(value)
    const decrypted = privateStore._decryptEntry(encrypted)
    expect(decrypted).toEqual(value)
  })

  it('should throw if not synced', async () => {
    expect(privateStore.set('key', 'value')).rejects.toThrow(/_sync must/)
    expect(privateStore.get('key')).rejects.toThrow(/_sync must/)
    expect(privateStore.remove('key')).rejects.toThrow(/_sync must/)
  })

  it('should create a new orbitdb kv-store on first _sync', async () => {
    await privateStore._sync()
    latestRoot = privateStore.db.address.root
    expect(privateStore.db).toBeDefined()

    // Check if salt was initiated correctly
    const encryptedSalt = privateStore.db.get('3BOX_SALT')
    expect(encryptedSalt).toBeDefined()
  })

  it('should set values correctly', async () => {
    await privateStore.set('key1', 'value1')
    let dbkey = privateStore._genDbKey('key1')
    let retreived = privateStore.db.get(dbkey)
    expect(privateStore._decryptEntry(retreived)).toEqual('value1')

    await privateStore.set('key2', 'lalalla')
    dbkey = privateStore._genDbKey('key2')
    retreived = privateStore.db.get(dbkey)
    expect(privateStore._decryptEntry(retreived)).toEqual('lalalla')

    await privateStore.set('key3', '12345')
    dbkey = privateStore._genDbKey('key3')
    retreived = privateStore.db.get(dbkey)
    expect(privateStore._decryptEntry(retreived)).toEqual('12345')
  })

  it('should get values correctly', async () => {
    let value = await privateStore.get('key1')
    expect(value).toEqual('value1')

    value = await privateStore.get('key2')
    expect(value).toEqual('lalalla')

    value = await privateStore.get('key3')
    expect(value).toEqual('12345')
  })

  it('should remove values correctly', async () => {
    await privateStore.remove('key3')
    expect(await privateStore.get('key3')).toBeNull()
    await privateStore.remove('key2')
    expect(await privateStore.get('key2')).toBeNull()
  })

  it('should sync an old orbitdb instance correctly', async () => {
    let privateStore2 = new PrivateStore(muportDIDMock, ipfsd.api, updateRoot)
    await privateStore2._sync(latestRoot)

    expect(await privateStore2.get('key1')).toEqual('value1')
    expect(await privateStore2.get('key2')).toBeNull()
    expect(await privateStore2.get('key3')).toBeNull()

    await privateStore2.close()
  })

  afterAll(async done => {
    await privateStore.close()
    ipfsd.stop(done)
  })
})
