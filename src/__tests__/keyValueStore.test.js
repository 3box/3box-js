const utils = require('./testUtils')
const KeyValueStore = require('../keyValueStore')
const OrbitDB = require('orbit-db')
const Identities = require('orbit-db-identity-provider')
const OdbIdentityProvider = require('../3id/odbIdentityProvider')
Identities.addIdentityProvider(OdbIdentityProvider)
const AccessControllers = require('orbit-db-access-controllers')
const LegacyIPFS3BoxAccessController = require('../access/legacyIpfs3Box')
AccessControllers.addAccessController({ AccessController: LegacyIPFS3BoxAccessController })
const didJWT = require('did-jwt')
const { registerMethod } = require('did-resolver')

const STORE_NAME = '09ab7cd93f9e.public'

const THREEID_MOCK = {
  DID: 'did:3:asdfasdf',
  getKeyringBySpaceName: () => {
    return {
      getPublicKeys: () => {
        return { signingKey: '044f5c08e2150b618264c4794d99a22238bf60f1133a7f563e74fcf55ddb16748159872687a613545c65567d2b7a4d4e3ac03763e1d9a5fcfe512a371faa48a781' }
      }
    }
  },
  signJWT: payload => {
    return didJWT.createJWT(payload, {
      signer: didJWT.SimpleSigner('95838ece1ac686bde68823b21ce9f564bc536eebb9c3500fa6da81f17086a6be'),
      issuer: 'did:3:asdfasdf'
    })
  }
}
registerMethod('3', async () => {
  return {
    '@context': 'https://w3id.org/did/v1',
    'id': 'did:3:asdfasdf',
    'publicKey': [{
      'id': 'did:3:asdfasdf#signingKey',
      'type': 'Secp256k1VerificationKey2018',
      'publicKeyHex': '044f5c08e2150b618264c4794d99a22238bf60f1133a7f563e74fcf55ddb16748159872687a613545c65567d2b7a4d4e3ac03763e1d9a5fcfe512a371faa48a781'
    }],
    'authentication': [{
      'type': 'Secp256k1SignatureAuthentication2018',
      'publicKey': 'did:2:asdfasdf#signingKey'
    }]
  }
})

const ensureConnected = jest.fn()


describe('KeyValueStore', () => {
  let ipfs
  let orbitdb
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
    keyValueStore = new KeyValueStore(orbitdb, STORE_NAME, ensureConnected, THREEID_MOCK)
  })

  beforeEach(() => {
    ensureConnected.mockClear()
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
  })

  it('should set and get values correctly', async () => {
    await keyValueStore.set('key1', 'value1')
    expect(await keyValueStore.get('key1')).toEqual('value1')
    expect(ensureConnected).toHaveBeenCalledTimes(1)

    await keyValueStore.set('key2', 'lalalla')
    expect(await keyValueStore.get('key2')).toEqual('lalalla')
    expect(ensureConnected).toHaveBeenCalledTimes(2)

    await keyValueStore.set('key3', '12345')
    expect(await keyValueStore.get('key3')).toEqual('12345')
    expect(ensureConnected).toHaveBeenCalledTimes(3)
  })

  it('should set and get multiple values correctly', async () => {
    await keyValueStore.setMultiple(['key4', 'key5'], ['yoyo', 'ma'])
    expect(await keyValueStore.get('key4')).toEqual('yoyo')
    expect(await keyValueStore.get('key5')).toEqual('ma')
    expect(ensureConnected).toHaveBeenCalledTimes(1)
  })

  it('should remove values correctly', async () => {
    await keyValueStore.remove('key3')
    expect(await keyValueStore.get('key3')).toBeUndefined()
    expect(ensureConnected).toHaveBeenCalledTimes(1)
    await keyValueStore.remove('key2')
    expect(await keyValueStore.get('key2')).toBeUndefined()
    expect(ensureConnected).toHaveBeenCalledTimes(2)
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
    let keyValueStore2 = new KeyValueStore(orbitdb2, STORE_NAME, null, THREEID_MOCK)
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
      keyValueStore = new KeyValueStore(orbitdb, 'store num' + storeNum++, () => {}, THREEID_MOCK)
      storeAddr = await keyValueStore._load()
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

  it('should including ALL entries, including DEL ops', async () => {
  })

  afterAll(async () => {
    await orbitdb.stop()
    await utils.stopIPFS(ipfs, 2)
  })
})
