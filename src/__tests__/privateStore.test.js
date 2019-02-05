const utils = require('./testUtils')
import PrivateStore from '../privateStore'

const STORE_NAME = '09ab7cd93f9e.private'
const emptyEnsureConn = () => {}

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
    getDid: () => 'did:muport:Qmsdfwerg',
    keyring: { signingKey: { deriveChild: () => { return { _hdkey: { _privateKey: Buffer.from('bf821847abe8434c96c0740ee0ae4779dbc93d9da8a25e4efdc4ecad6fc68c23') } } } } }
  }

  beforeAll(async () => {
    privateStore = new PrivateStore(muportDIDMock, 'orbitdb instance', STORE_NAME, emptyEnsureConn)
  })

  it('should be initialized correctly', async () => {
    expect(privateStore._salt).toEqual('f97f0d1ced93052700d740e23666ad9ff8b32366e3ce28696d3c9684f448142e')
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
      getDid: () => 'did:muport:Qmsdfwerg',
    keyring: { signingKey: { deriveChild: () => { return { _hdkey: { _privateKey: Buffer.from('bf821847abe8434c96c0740ee0ae4779dbc93d9da8a25e4efdc4ecad6fc68c23') } } } } }
    }
    const privateStore = new PrivateStore(muportDIDMock, 'orbitdb instance', STORE_NAME, emptyEnsureConn)

    privateStore._encryptEntry(value)
    const decrypted = privateStore._decryptEntry({nonce: '', ciphertext: ''})
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
      privateStore = new PrivateStore(muportDIDMock, 'orbitdb instance', STORE_NAME, emptyEnsureConn)
      const storeAddr = await privateStore._load()
      await privateStore.set('key1', 'value1')
    })

    it('should return array of ALL entries values of log underlying store decrypted', async () => {
      const log = privateStore.log
      const entry = log.pop()
      expect(entry.key).toEqual('1220240ad89944cd6376657a6b66594f5e20c7dcae5e22e589af8b581bd94bb759a9')
      expect(entry.value).toEqual('value1')
    })
  })
})
