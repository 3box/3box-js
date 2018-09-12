const testUtils = require('./testUtils')
const DAGNode = require('ipld-dag-pb').DAGNode
const jsdom = require('jsdom')
global.window = new jsdom.JSDOM().window

jest.mock('muport-core', () => {
  const did1 = 'did:muport:Qmsdfp98yw4t7'
  const did2 = 'did:muport:Qmsdsdf87g329'
  const serialized = 'such serialized state'
  const instance = (did, managementKey) => {
    return {
      serializeState: () => serialized,
      getDid: () => did,
      signJWT: ({hash}) => 'veryJWT,' + hash + ',' + did,
      getDidDocument: () => { return { managementKey } }
    }
  }
  const MuPort = function (serializeState) {
    expect(serializeState).toEqual(serialized)
    return instance(did1, '0x12345')
  }
  MuPort.newIdentity = (p, d, {externalMgmtKey}) => {
    const did = externalMgmtKey === '0x12345' ? did1 : did2
    return instance(did, externalMgmtKey)
  }
  return MuPort
})
jest.mock('../profileStore')
jest.mock('../privateStore')
jest.mock('../utils', () => {
  let hashmap = {}
  let linkmap = {}
  return {
    openBoxConsent: jest.fn(async () => '0x8726348762348723487238476238746827364872634876234876234'),
    httpRequest: jest.fn(async (url, method, payload) => {
      const split = url.split('/')
      const lastPart = split[split.length - 1]
      let x, hash, did
      switch (lastPart) {
        case 'hash': // put hash
          [x, hash, did] = payload.hash_token.split(',')
          hashmap[did] = hash
          return { status: 'success', data: { hash }}
        case 'link': // make a link
          did = payload.consent_msg.split(',')[1]
          const address = payload.consent_signature.split(',')[1]
          linkmap[address] = did
          return { status: 'success', data: { did, address }}
          break
        default: // default is GET hash
          if (hashmap[lastPart]) {
            return {status: 'success', data: { hash: hashmap[lastPart] } }
          } else if (hashmap[linkmap[lastPart]]) {
            return {status: 'success', data: { hash: hashmap[linkmap[lastPart]] } }
          } else {
            return {status: 'error', message: 'hash not found' }
          }
      }
    }),
    getLinkConsent: jest.fn(async (address, did, web3prov) => {
      return {
        msg: 'I agree to stuff,' + did,
        sig: '0xSuchRealSig,' + address
      }
    })
  }
})
const mockedUtils = require('../utils')
const MOCK_HASH_SERVER = 'hash-server'

const ThreeBox = require('../3box')

describe('3Box', () => {

  let ipfsd
  let threeBox
  let privStoreHash
  let profStoreHash

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
    ipfsd = await testUtils.spawnIPFSD()
  })

  beforeEach(() => {
    mockedUtils.openBoxConsent.mockClear()
    mockedUtils.httpRequest.mockClear()
    mockedUtils.getLinkConsent.mockClear()
  })

  it('should get entropy from signature first time openBox is called', async () => {
    const addr = '0x12345'
    const prov = 'web3prov'
    threeBox = await ThreeBox.openBox(addr, prov, { ipfs: ipfsd.api, hashServer: MOCK_HASH_SERVER })
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(1)
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledWith(addr, prov)
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(1)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith("hash-server/hash/did:muport:Qmsdfp98yw4t7", 'GET')
    expect(threeBox.profileStore._sync).toHaveBeenCalledTimes(1)
    expect(threeBox.profileStore._sync).toHaveBeenCalledWith(null)
    expect(threeBox.privateStore._sync).toHaveBeenCalledTimes(1)
    expect(threeBox.privateStore._sync).toHaveBeenCalledWith(null)
  })

  it('should get entropy from localstorage subsequent openBox calls', async () => {
    await ThreeBox.openBox('0x12345', 'web3prov', { ipfs: ipfsd.api, hashServer: MOCK_HASH_SERVER })
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(0)
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(1)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith("hash-server/hash/did:muport:Qmsdfp98yw4t7", 'GET')
    expect(threeBox.profileStore._sync).toHaveBeenCalledTimes(1)
    expect(threeBox.profileStore._sync).toHaveBeenCalledWith(null)
    expect(threeBox.privateStore._sync).toHaveBeenCalledTimes(1)
    expect(threeBox.privateStore._sync).toHaveBeenCalledWith(null)
  })

  it('should publish update to hash-server if store was updated', async () => {
    const dagNode = await createDAGNode('fakePrivateStore', [])
    privStoreHash = dagNode.toJSON().multihash
    await threeBox._publishUpdate('datastore', privStoreHash)
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(1)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith("hash-server/hash", 'POST', {
      hash_token: 'veryJWT,QmNYYHejZNNUPE6ZwARBHVsNwsQY949u9Xyo28Xug33Xm5,did:muport:Qmsdfp98yw4t7'
    })
  })

  it('should link profile on first profileStore update', async () => {
    const dagNode = await createDAGNode('fakeProfile', [])
    profStoreHash = dagNode.toJSON().multihash
    await threeBox._publishUpdate('profile', profStoreHash)
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(2)
    expect(mockedUtils.httpRequest).toHaveBeenNthCalledWith(1, "hash-server/link", 'POST', {
      consent_msg: 'I agree to stuff,did:muport:Qmsdfp98yw4t7',
      consent_signature: '0xSuchRealSig,0x12345',
      linked_did: 'did:muport:Qmsdfp98yw4t7'
    })
    expect(mockedUtils.httpRequest).toHaveBeenNthCalledWith(2, "hash-server/hash", 'POST', {
      hash_token: 'veryJWT,Qma1pDRcQrvZZpxfoqFADdBu3DedE57Xt9xLYA3AoyPoEE,did:muport:Qmsdfp98yw4t7'
    })
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(1)
  })

  it('should not link profile on second profileStore update', async () => {
    const dagNode = await createDAGNode(JSON.stringify({
      name: 'oed',
      imange: 'my nice selfie'
    }), [])
    // we are going to use this profile in a later test, add it to ipfs
    ipfsd.api.object.put(dagNode)
    profStoreHash = dagNode.toJSON().multihash
    await threeBox._publishUpdate('profile', profStoreHash)
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(1)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith("hash-server/hash", 'POST', {
      hash_token: 'veryJWT,QmPEZVAXMHptxKZ3K8qXwgaD6ffcF6pPjXEFutx6gFoodm,did:muport:Qmsdfp98yw4t7'
    })
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(0)
  })

  it('should fetch data correctly when reopening with openBox', async () => {
    threeBox = null
    threeBox = await ThreeBox.openBox('0x12345', 'web3prov', { ipfs: ipfsd.api, hashServer: MOCK_HASH_SERVER })
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(0)
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(1)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith("hash-server/hash/did:muport:Qmsdfp98yw4t7", 'GET')
    expect(threeBox.profileStore._sync).toHaveBeenCalledTimes(1)
    expect(threeBox.profileStore._sync).toHaveBeenCalledWith(profStoreHash)
    expect(threeBox.privateStore._sync).toHaveBeenCalledTimes(1)
    expect(threeBox.privateStore._sync).toHaveBeenCalledWith(privStoreHash)
  })

  it('should getProfile correctly', async () => {
    const profile = await ThreeBox.getProfile('0x12345', { ipfs: ipfsd.api, hashServer: MOCK_HASH_SERVER })
    expect(profile).toEqual({
      name: 'oed',
      imange: 'my nice selfie'
    })
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(1)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith("hash-server/hash/0x12345", 'GET')
  })

  it('should handle a second address/account correctly', async () => {
    const addr = '0xabcde'
    const prov = 'web3prov'
    let threeBox2 = await ThreeBox.openBox(addr, prov, { ipfs: ipfsd.api, hashServer: MOCK_HASH_SERVER })
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(1)
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledWith(addr, prov)
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(1)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith("hash-server/hash/did:muport:Qmsdsdf87g329", 'GET')
    expect(threeBox2.profileStore._sync).toHaveBeenCalledTimes(1)
    expect(threeBox2.profileStore._sync).toHaveBeenCalledWith(null)
    expect(threeBox2.privateStore._sync).toHaveBeenCalledTimes(1)
    expect(threeBox2.privateStore._sync).toHaveBeenCalledWith(null)

    // Check that link consent is called for this new address
    await threeBox2._publishUpdate('profile', profStoreHash)
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(1)
  })

  it('should clear cache correctly', async () => {
    await threeBox.logout()
    threeBox = null
    threeBox = await ThreeBox.openBox('0x12345', 'web3prov', { ipfs: ipfsd.api, hashServer: MOCK_HASH_SERVER })
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(1)
    await threeBox._publishUpdate('profile', profStoreHash)
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(1)
  })

  afterAll(async done => {
    ipfsd.stop(done)
  })
})

const createDAGNode = (data, links) => new Promise((resolve, reject) => {
  DAGNode.create(data, links, (err, node) => {
    if (err) reject(err)
    resolve(node)
  })
})

