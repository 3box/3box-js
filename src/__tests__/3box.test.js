const testUtils = require('./testUtils')
const IPFS = require('ipfs')
const OrbitDB = require('orbit-db')
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
      signJWT: ({odbAddress}) => 'veryJWT,' + odbAddress + ',' + did,
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
jest.mock('../profileStore', () => {
  return jest.fn(() => {
    return { _sync: jest.fn(() => '/orbitdb/Qmasdf/08a7.public') }
  })
})
jest.mock('../privateStore', () => {
  return jest.fn(() => {
    return { _sync: jest.fn(() => '/orbitdb/Qmfdsa/08a7.private') }
  })
})
jest.mock('../utils', () => {
  let addressMap = {}
  let linkmap = {}
  return {
    openBoxConsent: jest.fn(async () => '0x8726348762348723487238476238746827364872634876234876234'),
    httpRequest: jest.fn(async (url, method, payload) => {
      const split = url.split('/')
      const lastPart = split[split.length - 1]
      let x, hash, did
      switch (lastPart) {
        case 'odbAddress': // put odbAddress
          [x, hash, did] = payload.hash_token.split(',')
          addressMap[did] = hash
          return { status: 'success', data: { hash }}
        case 'link': // make a link
          did = payload.consent_msg.split(',')[1]
          const address = payload.consent_signature.split(',')[1]
          linkmap[address] = did
          return { status: 'success', data: { did, address }}
          break
        default: // default is GET odbAddress
          if (addressMap[lastPart]) {
            return {status: 'success', data: { odbAddress: addressMap[lastPart] } }
          } else if (addressMap[linkmap[lastPart]]) {
            return {status: 'success', data: { odbAddress: addressMap[linkmap[lastPart]] } }
          } else {
            throw '{"status": "error", "message": "odbAddress not found"}'
          }
      }
    }),
    getLinkConsent: jest.fn(async (address, did, web3prov) => {
      return {
        msg: 'I agree to stuff,' + did,
        sig: '0xSuchRealSig,' + address
      }
    }),
    sha256Multihash: jest.fn()
  }
})
const mockedUtils = require('../utils')
const MOCK_HASH_SERVER = 'hash-server'

const ThreeBox = require('../3box')

describe('3Box', () => {

  let ipfs
  let box
  let privStoreHash
  let profStoreHash
  jest.setTimeout(20000)

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
    ipfs = await initIPFS()
  })

  beforeEach(() => {
    mockedUtils.openBoxConsent.mockClear()
    mockedUtils.httpRequest.mockClear()
    mockedUtils.getLinkConsent.mockClear()
  })

  it('should get entropy from signature first time openBox is called', async () => {
    const addr = '0x12345'
    const prov = 'web3prov'
    box = await ThreeBox.openBox(addr, prov, { hashServer: MOCK_HASH_SERVER })
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(1)
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledWith(addr, prov)
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(2)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith("hash-server/odbAddress/did:muport:Qmsdfp98yw4t7", 'GET')
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith("hash-server/odbAddress", 'POST', {
      hash_token: 'veryJWT,/orbitdb/QmZUPkhDrB1YvnnNQzbA1MRS8F8TS67WU2aMFYBWDLpCMm/undefined.root,did:muport:Qmsdfp98yw4t7'
    })
    expect(box.profileStore._sync).toHaveBeenCalledTimes(1)
    expect(box.profileStore._sync).toHaveBeenCalledWith()
    expect(box.privateStore._sync).toHaveBeenCalledTimes(1)
    expect(box.privateStore._sync).toHaveBeenCalledWith()
  })

  it.skip('should get entropy and db from localstorage subsequent openBox calls', async () => {
    await box.close()
    box = await ThreeBox.openBox('0x12345', 'web3prov', { hashServer: MOCK_HASH_SERVER })
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(0)
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(1)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith("hash-server/odbAddress/did:muport:Qmsdfp98yw4t7", 'GET')
    expect(box.profileStore._sync).toHaveBeenCalledTimes(1)
    expect(box.profileStore._sync).toHaveBeenCalledWith('/orbitdb/Qmasdf/08a7.public')
    expect(box.privateStore._sync).toHaveBeenCalledTimes(1)
    expect(box.privateStore._sync).toHaveBeenCalledWith('/orbitdb/Qmfdsa/08a7.private')
  })

  it('should sync db updates to remote pinning server', async () => {
    //await new Promise((resolve, reject) => ipfs.swarm.connect('/ip4/127.0.0.1/tcp/4002/ipfs/QmSMcMa3hRgDjvsvbNihsUNZ9ywW19etQBRB6dbnrptfRP', resolve))
    const orbitdb = new OrbitDB(ipfs, './tmp/orbitdb2')
    const rootStoreAddress = box._rootStore.address.toString()
    const store = await orbitdb.open(rootStoreAddress)
    await new Promise((resolve, reject) => {
      store.events.on('replicate.progress', (_x, _y, _z, num, max) => {
        if (num === max) resolve()
      })
    })
    //console.log('repbox', box._rootStore.iterator({ limit: -1 }).collect().length)
    //console.log('repserv', store.iterator({ limit: -1 }).collect().length)
    await box._rootStore.drop()
    await box.close()
    //console.log('i1', (await box._ipfs.swarm.peers()))
    //console.log('p1', await box._ipfs.pubsub.ls())
    //console.log('i2', (await ipfs.swarm.peers())[0].addr.toString())
    //console.log('p2', await ipfs.pubsub.ls())
    box = await ThreeBox.openBox('0x12345', 'web3prov', { hashServer: MOCK_HASH_SERVER })
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(0)
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(1)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith("hash-server/odbAddress/did:muport:Qmsdfp98yw4t7", 'GET')
    expect(box.profileStore._sync).toHaveBeenCalledTimes(1)
    expect(box.profileStore._sync).toHaveBeenCalledWith('/orbitdb/Qmasdf/08a7.public')
    expect(box.privateStore._sync).toHaveBeenCalledTimes(1)
    expect(box.privateStore._sync).toHaveBeenCalledWith('/orbitdb/Qmfdsa/08a7.private')
  })

  it('should link profile on call to _linkProfile', async () => {
    await box._linkProfile()
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(1)
    expect(mockedUtils.httpRequest).toHaveBeenNthCalledWith(1, "hash-server/link", 'POST', {
      consent_msg: 'I agree to stuff,did:muport:Qmsdfp98yw4t7',
      consent_signature: '0xSuchRealSig,0x12345',
      linked_did: 'did:muport:Qmsdfp98yw4t7'
    })
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(1)
  })

  it('should not link profile on second call to _linkProfile', async () => {
    await box._linkProfile()
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(0)
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(0)
  })

  it.skip('should fetch data correctly when reopening with openBox', async () => {
    box = null
    box = await ThreeBox.openBox('0x12345', 'web3prov', { ipfs: ipfsd.api, hashServer: MOCK_HASH_SERVER })
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(0)
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(1)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith("hash-server/hash/did:muport:Qmsdfp98yw4t7", 'GET')
    expect(box.profileStore._sync).toHaveBeenCalledTimes(1)
    expect(box.profileStore._sync).toHaveBeenCalledWith(profStoreHash)
    expect(box.privateStore._sync).toHaveBeenCalledTimes(1)
    expect(box.privateStore._sync).toHaveBeenCalledWith(privStoreHash)
  })

  it.skip('should getProfile correctly', async () => {
    const profile = await ThreeBox.getProfile('0x12345', { ipfs: ipfsd.api, hashServer: MOCK_HASH_SERVER })
    expect(profile).toEqual({
      name: 'oed',
      imange: 'my nice selfie'
    })
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(1)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith("hash-server/hash/0x12345", 'GET')
  })

  it.skip('should handle a second address/account correctly', async () => {
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

  it.skip('should clear cache correctly', async () => {
    await box.logout()
    box = null
    box = await ThreeBox.openBox('0x12345', 'web3prov', { ipfs: ipfsd.api, hashServer: MOCK_HASH_SERVER })
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(1)
    await box._publishUpdate('profile', profStoreHash)
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(1)
  })

  afterAll(async () => {
    await box.close()
    await ipfs.stop()
  })
})

async function initIPFS () {
  return new Promise((resolve, reject) => {
    let ipfs = new IPFS({
      EXPERIMENTAL: {
        pubsub: true
      },
      repo: './tmp/ipfs2/',
      config: {
        Addresses: {
          Swarm: [
            '/ip4/0.0.0.0/tcp/4004',
            '/ip4/127.0.0.1/tcp/4005/ws'
          ],
          API: '/ip4/127.0.0.1/tcp/5003',
          Gateway: '/ip4/127.0.0.1/tcp/9091'
        }
      }
    })
    ipfs.on('error', reject)
    ipfs.on('ready', () => resolve(ipfs))
  })
}
