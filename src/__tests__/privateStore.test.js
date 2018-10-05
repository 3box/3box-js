const utils = require('./testUtils')
const PrivateStore = require('../privateStore')

const STORE_NAME = '09ab7cd93f9e.private'

jest.mock('../keyValueStore')

describe('PrivateStore', () => {
  let privateStore
  let encryptedSalt

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

  beforeAll(async () => {
    privateStore = new PrivateStore(muportDIDMock, 'orbitdb instance', STORE_NAME)
  })

  it('should encrypt and decrypt correctly', async () => {
    const value = 'my super secret string'
    const encrypted = privateStore._encryptEntry(value)
    const decrypted = privateStore._decryptEntry(encrypted)
    expect(decrypted).toEqual(value)
  })

  it('should (un)pad encrypted values (with blocksize = 24)', async () => {
    const value = 'my secret string'
    let paddedVal
    const muportDIDMock = {
      symEncrypt: cleartext => {
        paddedVal = cleartext
        expect(cleartext.length % 24).toEqual(0)
      },
      symDecrypt: () => paddedVal,
      getDid: () => 'did:muport:Qmsdfwerg'
    }
    const privateStore = new PrivateStore(muportDIDMock, 'orbitdb instance', STORE_NAME)

    privateStore._encryptEntry(value)
    const decrypted = privateStore._decryptEntry({nonce: '', ciphertext: ''})
    expect(decrypted).toEqual(value)
  })

  it('should throw if not synced', async () => {
    expect(privateStore.set('key', 'value')).rejects.toThrow(/_sync must/)
    expect(privateStore.get('key')).rejects.toThrow(/_sync must/)
    expect(privateStore.remove('key')).rejects.toThrow(/_sync must/)
  })

  it('should create a salt on first _sync', async () => {
    const address = await privateStore._sync('addr')
    expect(address).toEqual('addr')

    // Check if salt was initiated correctly
    encryptedSalt = privateStore._db.get('3BOX_SALT')
    expect(encryptedSalt).toBeDefined()
  })

  it('should not generate new salt on subsequent _sync', async () => {
    const address = await privateStore._sync('addr')
    expect(address).toEqual('addr')

    // Check if salt was initiated correctly
    newEncryptedSalt = privateStore._db.get('3BOX_SALT')
    expect(newEncryptedSalt).toEqual(encryptedSalt)
  })

  it('should set values correctly', async () => {
    await privateStore.set('key1', 'value1')
    let dbkey = privateStore._genDbKey('key1')
    let retreived = privateStore._db.get(dbkey)
    expect(privateStore._decryptEntry(retreived)).toEqual('value1')

    await privateStore.set('key2', 'lalalla')
    dbkey = privateStore._genDbKey('key2')
    retreived = privateStore._db.get(dbkey)
    expect(privateStore._decryptEntry(retreived)).toEqual('lalalla')

    await privateStore.set('key3', '12345')
    dbkey = privateStore._genDbKey('key3')
    retreived = privateStore._db.get(dbkey)
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

  describe('log', () => {

    beforeEach(async () => {
      privateStore = new PrivateStore(muportDIDMock, 'orbitdb instance', STORE_NAME)
      storeAddr = await privateStore._sync()
      await privateStore.set('key1', 'value1')
    })

    it('should return array of ALL entries values of log underlying store decrypted', async () => {
      const log = privateStore.log
      const entry = log.pop()
      expect(entry.key).toEqual('hash')
      expect(entry.value).toEqual('value1')
    })
  })
})
