const testUtils = require('./testUtils')
const OrbitDB = require('orbit-db')
const Pubsub = require('orbit-db-pubsub')
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
      signJWT: ({ rootStoreAddress }) => 'veryJWT,' + rootStoreAddress + ',' + did,
      getDidDocument: () => { return { managementKey } },
      keyring: { signingKey: { _hdkey: { _privateKey: Buffer.from('f917ac6883f88798a8ce39821fa523f2acd17c0ba80c724f219367e76d8f2c46', 'hex') } } }
    }
  }
  const MuPort = function (serializeState) {
    expect(serializeState).toEqual(serialized)
    return instance(did1, '0x12345')
  }
  MuPort.newIdentity = (p, d, { externalMgmtKey }) => {
    const did = externalMgmtKey === '0x12345' ? did1 : did2
    return instance(did, externalMgmtKey)
  }
  return MuPort
})
jest.mock('../publicStore', () => {
  return jest.fn(() => {
    return {
      _sync: jest.fn(() => '/orbitdb/Qmasdf/08a7.public'),
      all: jest.fn(() => { return { name: 'oed', image: 'an awesome selfie' } }),
      close: jest.fn()
    }
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
          [x, hash, did] = payload.address_token.split(',')
          addressMap[did] = hash
          return { status: 'success', data: { hash } }
        case 'link': // make a link
          did = payload.consent_msg.split(',')[1]
          const address = payload.consent_signature.split(',')[1]
          linkmap[address] = did
          return { status: 'success', data: { did, address } }
          break
        default: // default is GET odbAddress
          if (addressMap[lastPart]) {
            return { status: 'success', data: { rootStoreAddress: addressMap[lastPart] } }
          } else if (addressMap[linkmap[lastPart]]) {
            return { status: 'success', data: { rootStoreAddress: addressMap[linkmap[lastPart]] } }
          } else {
            throw '{"status": "error", "message": "root store address not found"}'
          }
      }
    }),
    getLinkConsent: jest.fn(async (address, did, web3prov) => {
      return {
        msg: 'I agree to stuff,' + did,
        sig: '0xSuchRealSig,' + address
      }
    }),
    sha256Multihash: jest.fn(str => {
      if (str === 'did:muport:Qmsdsdf87g329') return 'ab8c73d8f'
      return 'b932fe7ab'
    })
  }
})
const mockedUtils = require('../utils')
const MOCK_HASH_SERVER = 'address-server'
const boxOpts = {
  ipfsOptions: {
    EXPERIMENTAL: {
      pubsub: true
    },
    repo: './tmp/ipfs1/'
  },
  orbitPath: './tmp/orbitdb1',
  addressServer: MOCK_HASH_SERVER
}
const boxOpts2 = {
  ipfsOptions: {
    EXPERIMENTAL: {
      pubsub: true
    },
    repo: './tmp/ipfs3/'
  },
  orbitPath: './tmp/orbitdb1',
  addressServer: MOCK_HASH_SERVER
}

const ThreeBox = require('../3box')

describe('3Box', () => {
  let ipfs
  let pubsub
  let box
  let box2
  let orbitdb
  jest.setTimeout(25000)

  beforeAll(async () => {
    ipfs = await testUtils.initIPFS(true)
    const ipfsMultiAddr = (await ipfs.id()).addresses[0]
    boxOpts.pinningNode = ipfsMultiAddr
    boxOpts2.pinningNode = ipfsMultiAddr
    pubsub = new Pubsub(ipfs, (await ipfs.id()).id)
  })

  beforeEach(() => {
    mockedUtils.openBoxConsent.mockClear()
    mockedUtils.httpRequest.mockClear()
    mockedUtils.getLinkConsent.mockClear()
  })

  it('should get entropy from signature first time openBox is called', async () => {
    const publishPromise = new Promise((resolve, reject) => {
      pubsub.subscribe('3box-pinning', (topic, data) => {
        expect(data.odbAddress).toEqual('/orbitdb/QmdmiLpbTca1bbYaTHkfdomVNUNK4Yvn4U1nTCYfJwy6Pn/b932fe7ab.root')
        resolve()
      }, () => {})
    })
    const addr = '0x12345'
    const prov = 'web3prov'
    const consentCallback = jest.fn()
    const opts = { ...boxOpts, consentCallback }
    box = await ThreeBox.openBox(addr, prov, opts)
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(1)
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledWith(addr, prov)
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(2)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith('address-server/odbAddress/did:muport:Qmsdfp98yw4t7', 'GET')
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith('address-server/odbAddress', 'POST', {
      address_token: 'veryJWT,/orbitdb/QmdmiLpbTca1bbYaTHkfdomVNUNK4Yvn4U1nTCYfJwy6Pn/b932fe7ab.root,did:muport:Qmsdfp98yw4t7'
    })
    expect(box.public._sync).toHaveBeenCalledTimes(1)
    expect(box.public._sync).toHaveBeenCalledWith()
    expect(box.private._sync).toHaveBeenCalledTimes(1)
    expect(box.private._sync).toHaveBeenCalledWith()
    expect(consentCallback).toHaveBeenCalledTimes(1)
    expect(consentCallback).toHaveBeenCalledWith(true)
    await publishPromise
    pubsub.unsubscribe('3box-pinning')
  })

  it('should get entropy and db from localstorage subsequent openBox calls', async () => {
    const consentCallback = jest.fn()
    const opts = { ...boxOpts, consentCallback }
    await box.close()
    box = await ThreeBox.openBox('0x12345', 'web3prov', opts)
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(0)
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(1)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith('address-server/odbAddress/did:muport:Qmsdfp98yw4t7', 'GET')
    expect(box.public._sync).toHaveBeenCalledTimes(1)
    expect(box.public._sync).toHaveBeenCalledWith('/orbitdb/Qmasdf/08a7.public')
    expect(box.private._sync).toHaveBeenCalledTimes(1)
    expect(box.private._sync).toHaveBeenCalledWith('/orbitdb/Qmfdsa/08a7.private')
    expect(consentCallback).toHaveBeenCalledTimes(1)
    expect(consentCallback).toHaveBeenCalledWith(false)
  })

  it('should sync db updates to/from remote pinning server', async () => {
    const publishPromise = new Promise((resolve, reject) => {
      pubsub.subscribe('3box-pinning', (topic, data) => {
        expect(data.odbAddress).toEqual('/orbitdb/QmdmiLpbTca1bbYaTHkfdomVNUNK4Yvn4U1nTCYfJwy6Pn/b932fe7ab.root')
        resolve()
      }, () => {})
    })
    orbitdb = new OrbitDB(ipfs, './tmp/orbitdb2')
    const rootStoreAddress = box._rootStore.address.toString()
    const store = await orbitdb.open(rootStoreAddress)
    await new Promise((resolve, reject) => {
      store.events.on('replicate.progress', (_x, _y, _z, num, max) => {
        if (num === max) resolve()
      })
    })
    // console.log('p1 id', (await ipfs.id()).id)
    // console.log('serverPeers', await ipfs.pubsub.peers('/orbitdb/QmdmiLpbTca1bbYaTHkfdomVNUNK4Yvn4U1nTCYfJwy6Pn/b932fe7ab.root'))
    // console.log(await ipfs.id())
    await box._rootStore.drop()
    await box.close()
    // console.log(await ipfs.pubsub.peers('/orbitdb/QmdmiLpbTca1bbYaTHkfdomVNUNK4Yvn4U1nTCYfJwy6Pn/b932fe7ab.root'))
    // await ipfs.pubsub.subscribe('/orbitdb/QmdmiLpbTca1bbYaTHkfdomVNUNK4Yvn4U1nTCYfJwy6Pn/b932fe7ab.root', console.log)
    // console.log('p1', (await ipfs.swarm.peers())[0].addr.toString())
    // console.log('p1', await ipfs.pubsub.ls())
    // Something weird happens when using the same ipfs repo using boxOpts2 for now.
    box = await ThreeBox.openBox('0x12345', 'web3prov', boxOpts2)
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(0)
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(1)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith('address-server/odbAddress/did:muport:Qmsdfp98yw4t7', 'GET')
    expect(box.public._sync).toHaveBeenCalledTimes(1)
    expect(box.public._sync).toHaveBeenCalledWith('/orbitdb/Qmasdf/08a7.public')
    expect(box.private._sync).toHaveBeenCalledTimes(1)
    expect(box.private._sync).toHaveBeenCalledWith('/orbitdb/Qmfdsa/08a7.private')
    await publishPromise
    pubsub.unsubscribe('3box-pinning')
  })

  it('should link profile on call to _linkProfile', async () => {
    await box._linkProfile()
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(1)
    expect(mockedUtils.httpRequest).toHaveBeenNthCalledWith(1, 'address-server/link', 'POST', {
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

  it('should handle a second address/account correctly', async () => {
    const publishPromise = new Promise((resolve, reject) => {
      pubsub.subscribe('3box-pinning', (topic, data) => {
        expect(data.odbAddress).toEqual('/orbitdb/QmQsx8o2qZgTHvXVvL6y6o5nmK4PxMuLyEYptjgUAgfy9m/ab8c73d8f.root')
        resolve()
      }, () => {})
    })
    await box.close()
    const addr = '0xabcde'
    const prov = 'web3prov'
    box2 = await ThreeBox.openBox(addr, prov, boxOpts)

    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(1)
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledWith(addr, prov)
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(2)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith('address-server/odbAddress/did:muport:Qmsdsdf87g329', 'GET')
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith('address-server/odbAddress', 'POST', {
      address_token: 'veryJWT,/orbitdb/QmQsx8o2qZgTHvXVvL6y6o5nmK4PxMuLyEYptjgUAgfy9m/ab8c73d8f.root,did:muport:Qmsdsdf87g329'
    })
    expect(box2.public._sync).toHaveBeenCalledTimes(1)
    expect(box2.public._sync).toHaveBeenCalledWith()
    expect(box2.private._sync).toHaveBeenCalledTimes(1)
    expect(box2.private._sync).toHaveBeenCalledWith()

    await box2._linkProfile()
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(3)
    expect(mockedUtils.httpRequest).toHaveBeenNthCalledWith(3, 'address-server/link', 'POST', {
      consent_msg: 'I agree to stuff,did:muport:Qmsdsdf87g329',
      consent_signature: '0xSuchRealSig,0xabcde',
      linked_did: 'did:muport:Qmsdsdf87g329'
    })
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(1)
    await publishPromise
    pubsub.unsubscribe('3box-pinning')
  })

  it('should getProfile correctly', async () => {
    await box._rootStore.drop()
    // awaitbox2._ruotStore.drop()
    const profile = await ThreeBox.getProfile('0x12345', boxOpts)
    expect(profile).toEqual({
      name: 'oed',
      image: 'an awesome selfie'
    })
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(1)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith('address-server/odbAddress/0x12345', 'GET')
  })

  it('should clear cache correctly', async () => {
    await box2.logout()
    box2 = null
    box2 = await ThreeBox.openBox('0xabcde', 'web3prov', boxOpts)
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(1)
    await box2._linkProfile()
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(1)
    await box2.close()
  })

  it('should getProfile correctly when box is not open', async () => {
    const profile = await ThreeBox.getProfile('0x12345', boxOpts)
    expect(profile).toEqual({
      name: 'oed',
      image: 'an awesome selfie'
    })
    expect(mockedUtils.httpRequest).toHaveBeenCalledTimes(1)
    expect(mockedUtils.httpRequest).toHaveBeenCalledWith('address-server/odbAddress/0x12345', 'GET')
  })

  afterAll(async () => {
    await pubsub.disconnect()
    await ipfs.stop()
  })
})
