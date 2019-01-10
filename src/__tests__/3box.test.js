const testUtils = require('./testUtils')
const OrbitDB = require('orbit-db')
const Pubsub = require('orbit-db-pubsub')
const jsdom = require('jsdom')
const IPFS = require('ipfs')
const Box = require('../3box')
global.window = new jsdom.JSDOM().window

jest.mock('muport-core', () => {
  const did1 = 'did:muport:Qmsdfp98yw4t7'
  const did2 = 'did:muport:Qmsdsdf87g329'
  const serialized = 'such serialized state'
  const instance = (did, managementKey) => {
    return {
      serializeState: () => serialized,
      getDid: () => did,
      signJWT: (data) => {
        if (data && data.rootStoreAddress) {
          return 'veryJWT,' + data.rootStoreAddress + ',' + did
        } else {
          return 'veryJWT,' + did
        }
      },
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
      _load: jest.fn(() => '/orbitdb/Qmasdf/08a7.public'),
      get: jest.fn(),
      set: jest.fn(),
      all: jest.fn(() => { return { name: 'oed', image: 'an awesome selfie' } }),
      close: jest.fn()
    }
  })
})
jest.mock('../privateStore', () => {
  return jest.fn(() => {
    return {
      _sync: jest.fn(() => '/orbitdb/Qmfdsa/08a7.private'),
      _load: jest.fn(() => '/orbitdb/Qmfdsa/08a7.private')
    }
  })
})

jest.mock('../utils/verifier')
jest.mock('../utils/index', () => {
  const sha256 = require('js-sha256').sha256
  let addressMap = {}
  let linkmap = {}
  let linkNum = 0
  return {
    openBoxConsent: jest.fn(async () => '0x8726348762348723487238476238746827364872634876234876234'),
    fetchJson: jest.fn(async (url, body) => {
      const split = url.split('/')
      const lastPart = split[split.length - 1]
      let x, hash, did
      switch (lastPart) {
        case 'odbAddress': // put odbAddress
          [x, hash, did] = body.address_token.split(',')
          addressMap[did] = hash
          return { status: 'success', data: { hash } }
        case 'link': // make a link
          if (linkNum < 2) {
            linkNum += 1
            return Promise.reject('{ status: "error", message: "an error" }')
          } else {
            did = body.consent_msg.split(',')[1]
            const address = body.consent_signature.split(',')[1]
            linkmap[address] = did
            return { status: 'success', data: { did, address } }
          }
        default:
          // post profileList (profile api)
          if(/profileList/.test(lastPart)) {
            return {'0x12345': { name: 'zfer', email: 'zfer@mail.com' }}
          }
          // get profile from profile api
          if(/profile/.test(lastPart)) {
             return { name: 'zfer', email: 'zfer@mail.com' }
          }
          // default is GET odbAddress
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
    }),
    sha256
  }
})

const mockedUtils = require('../utils/index')
const MOCK_HASH_SERVER = 'address-server'
const MOCK_PROFILE_SERVER = 'profile-server'

describe('3Box', () => {
  let ipfs, pubsub, boxOpts, ipfsBox, box
  jest.setTimeout(30000)

  beforeEach(async () => {
    if (!ipfs) ipfs = await testUtils.initIPFS(0)
    const ipfsMultiAddr = (await ipfs.id()).addresses[0]
    if (!pubsub) pubsub = new Pubsub(ipfs, (await ipfs.id()).id)

    const IPFS_OPTIONS = {
      EXPERIMENTAL: {
        pubsub: true
      },
      repo: './tmp/ipfs1/'
    }

    if (!ipfsBox) {
      //ipfsBox = new IPFS(IPFS_OPTIONS)
      ipfsBox = await testUtils.initIPFS(1)
      //await new Promise((resolve, reject) => { ipfsBox.on('ready', () => resolve() )})
    }

    boxOpts = {
      ipfs: ipfsBox,
      //ipfsOptions: IPFS_OPTIONS,
      orbitPath: './tmp/orbitdb1',
      addressServer: MOCK_HASH_SERVER,
      profileServer: MOCK_PROFILE_SERVER,
      iframeStore: false,
      pinningNode: ipfsMultiAddr
    }

    mockedUtils.openBoxConsent.mockClear()
    mockedUtils.fetchJson.mockClear()
    mockedUtils.getLinkConsent.mockClear()
  })

  afterAll(async () => {
  await pubsub.disconnect()
  //await ipfs.stop()
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
    box = await Box.openBox(addr, prov, opts)
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(1)
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledWith(addr, prov)
    expect(box.public._load).toHaveBeenCalledTimes(1)
    expect(box.public._load).toHaveBeenCalledWith()
    expect(box.private._load).toHaveBeenCalledTimes(1)
    expect(box.private._load).toHaveBeenCalledWith()
    expect(consentCallback).toHaveBeenCalledTimes(1)
    expect(consentCallback).toHaveBeenCalledWith(true)
    await publishPromise

    const syncPromise = new Promise((resolve, reject) => { box.onSyncDone(resolve) })
    pubsub.publish('3box-pinning', { type: 'HAS_ENTRIES', odbAddress: '/orbitdb/Qmasdf/08a7.public', numEntries: 4 })
    pubsub.publish('3box-pinning', { type: 'HAS_ENTRIES', odbAddress: '/orbitdb/Qmfdsa/08a7.private', numEntries: 5 })
    await syncPromise
    expect(box.public.get).toHaveBeenNthCalledWith(1, 'proof_did')
    expect(box.public.set).toHaveBeenNthCalledWith(1, 'proof_did', 'veryJWT,did:muport:Qmsdfp98yw4t7')
    expect(mockedUtils.fetchJson).toHaveBeenCalledTimes(1)
    expect(mockedUtils.fetchJson).toHaveBeenCalledWith('address-server/odbAddress', {
      address_token: 'veryJWT,/orbitdb/QmdmiLpbTca1bbYaTHkfdomVNUNK4Yvn4U1nTCYfJwy6Pn/b932fe7ab.root,did:muport:Qmsdfp98yw4t7'
    })

    pubsub.unsubscribe('3box-pinning')
  })


  it('should get entropy from localstorage subsequent openBox calls', async () => {
    const consentCallback = jest.fn()
    const opts = { ...boxOpts, consentCallback }
    await box.close()
    box = await Box.openBox('0x12345', 'web3prov', opts)
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(0)
    expect(box.public._load).toHaveBeenCalledTimes(1)
    expect(box.public._load).toHaveBeenCalledWith()
    expect(box.private._load).toHaveBeenCalledTimes(1)
    expect(box.private._load).toHaveBeenCalledWith()
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

    // TODO end after all
    const orbitdb = new OrbitDB(ipfs, './tmp/orbitdb3')
    const rootStoreAddress = box._rootStore.address.toString()
    const store = await orbitdb.open(rootStoreAddress)
    await new Promise((resolve, reject) => {
      store.events.on('replicate.progress', (_x, _y, _z, num, max) => {
        if (num === max) resolve()
      })
    })

    pubsub.unsubscribe('3box-pinning')
    await box._rootStore.drop()
    await box.close()
    pubsub.subscribe('3box-pinning', (topic, data) => {}, (topic, peer) => {
      pubsub.publish('3box-pinning', { type: 'HAS_ENTRIES', odbAddress: '/orbitdb/Qmasdf/08a7.public', numEntries: 4 })
      pubsub.publish('3box-pinning', { type: 'HAS_ENTRIES', odbAddress: '/orbitdb/Qmfdsa/08a7.private', numEntries: 5 })
    })

    box = await Box.openBox('0x12345', 'web3prov', boxOpts)
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(0)
    expect(mockedUtils.fetchJson).toHaveBeenCalledTimes(1)

    box.public.get.mockImplementationOnce(() => 'did proof JWT')
    const syncPromise = new Promise((resolve, reject) => { box.onSyncDone(resolve) })
    await syncPromise
    expect(box.public.get).toHaveBeenCalledWith('proof_did')
    expect(box.public.set).toHaveBeenCalledTimes(0)

    expect(box.public._sync).toHaveBeenCalledTimes(1)
    expect(box.public._sync).toHaveBeenCalledWith(4)
    expect(box.private._sync).toHaveBeenCalledTimes(1)
    expect(box.private._sync).toHaveBeenCalledWith(5)
    await publishPromise
    pubsub.unsubscribe('3box-pinning')
  })

  it('ensurePinningNodeConnected should not do anything if already connected to given pubsub room', async () => {
    const publishPromise = new Promise((resolve, reject) => {
      pubsub.subscribe('3box-pinning', (topic, data) => {
        expect(data.odbAddress).toEqual('/orbitdb/QmdmiLpbTca1bbYaTHkfdomVNUNK4Yvn4U1nTCYfJwy6Pn/b932fe7ab.root')
        resolve()
      }, () => {})
    })
    const peers = (await ipfs.swarm.peers())// [0].addr
    await Promise.all(peers.map(async peer => {
      await ipfs.swarm.disconnect(peer.addr)
    }))
    expect((await ipfs.swarm.peers()).length).toEqual(0)
    await box._ensurePinningNodeConnected('non existant pubsub room')
    await publishPromise
    expect((await ipfs.swarm.peers()).length).toEqual(1)
    pubsub.unsubscribe('3box-pinning')
  })

  it('should handle error and not link profile on first call to _linkProfile', async () => {
    // first two calls in our mock will throw an error
    box.public.get = jest.fn()
    global.console.error = jest.fn()
    await box._linkProfile()
    expect(global.console.error).toHaveBeenCalledTimes(1)
    expect(mockedUtils.fetchJson).toHaveBeenCalledTimes(1)
    expect(mockedUtils.fetchJson).toHaveBeenNthCalledWith(1, 'address-server/link', {
      consent_msg: 'I agree to stuff,did:muport:Qmsdfp98yw4t7',
      consent_signature: '0xSuchRealSig,0x12345',
      linked_did: 'did:muport:Qmsdfp98yw4t7'
    })
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(1)
    expect(box.public.set).toHaveBeenCalledTimes(1)
  })

  it('should not call getLinkConsent if ethereum_proof in publicStore on call to _linkProfile', async () => {
    // first two calls in our mock will throw an error
    box.public.set.mockClear()
    box.public.get = jest.fn(() => {
      return {
        consent_msg: 'I agree to stuff,did:muport:Qmsdfp98yw4t7',
        consent_signature: '0xSuchRealSig,0x12345',
        linked_did: 'did:muport:Qmsdfp98yw4t7'
      }
    })
    global.console.error = jest.fn()
    await box._linkProfile()
    expect(global.console.error).toHaveBeenCalledTimes(1)
    expect(mockedUtils.fetchJson).toHaveBeenCalledTimes(1)
    expect(mockedUtils.fetchJson).toHaveBeenNthCalledWith(1, 'address-server/link', {
      consent_msg: 'I agree to stuff,did:muport:Qmsdfp98yw4t7',
      consent_signature: '0xSuchRealSig,0x12345',
      linked_did: 'did:muport:Qmsdfp98yw4t7'
    })
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(0)
    expect(box.public.set).toHaveBeenCalledTimes(0)
  })


  it('should link profile on call to _linkProfile', async () => {
    box.public.set.mockClear()
    box.public.get = jest.fn()
    await box._linkProfile()
    expect(mockedUtils.fetchJson).toHaveBeenCalledTimes(1)
    expect(mockedUtils.fetchJson).toHaveBeenNthCalledWith(1, 'address-server/link', {
      consent_msg: 'I agree to stuff,did:muport:Qmsdfp98yw4t7',
      consent_signature: '0xSuchRealSig,0x12345',
      linked_did: 'did:muport:Qmsdfp98yw4t7'
    })
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(1)
    expect(box.public.set).toHaveBeenCalledTimes(1)
  })

  it('should not link profile on second call to _linkProfile', async () => {
    box.public.set.mockClear()
    await box._linkProfile()
    expect(mockedUtils.fetchJson).toHaveBeenCalledTimes(0)
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(0)
    expect(box.public.set).toHaveBeenCalledTimes(0)
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
     box = await Box.openBox(addr, prov, boxOpts)

     expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(1)
     expect(mockedUtils.openBoxConsent).toHaveBeenCalledWith(addr, prov)
     expect(box.public._load).toHaveBeenCalledTimes(1)
     expect(box.public._load).toHaveBeenCalledWith()
     expect(box.private._load).toHaveBeenCalledTimes(1)
     expect(box.private._load).toHaveBeenCalledWith()

     await box._linkProfile()
     expect(mockedUtils.fetchJson).toHaveBeenCalledTimes(1)
     expect(mockedUtils.fetchJson).toHaveBeenNthCalledWith(1, 'address-server/link', {
       consent_msg: 'I agree to stuff,did:muport:Qmsdsdf87g329',
       consent_signature: '0xSuchRealSig,0xabcde',
       linked_did: 'did:muport:Qmsdsdf87g329'
     })
     expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(1)
     await publishPromise
     expect(mockedUtils.fetchJson).toHaveBeenCalledTimes(2)
     expect(mockedUtils.fetchJson).toHaveBeenNthCalledWith(2, 'address-server/odbAddress', {
       address_token: 'veryJWT,/orbitdb/QmQsx8o2qZgTHvXVvL6y6o5nmK4PxMuLyEYptjgUAgfy9m/ab8c73d8f.root,did:muport:Qmsdsdf87g329'
     })
     pubsub.unsubscribe('3box-pinning')
   })

   it('should getProfile correctly (when profile API is not used)', async () => {
    await box._rootStore.drop()
    // awaitbox2._ruotStore.drop()
    const profile = await Box.getProfile('0x12345', Object.assign(boxOpts, {useCacheService: false}))
    expect(profile).toEqual({
      name: 'oed',
      image: 'an awesome selfie'
    })
    expect(mockedUtils.fetchJson).toHaveBeenCalledTimes(1)
    expect(mockedUtils.fetchJson).toHaveBeenCalledWith('address-server/odbAddress/0x12345')
  })

  it('should get profile (when API is used)', async () => {
    const profile = await Box.getProfile('0x12345', boxOpts)
    expect(profile).toEqual({
      name: 'zfer',
      email: 'zfer@mail.com'
    })
    expect(mockedUtils.fetchJson).toHaveBeenCalledWith('profile-server/profile?address=0x12345')
  })

  it('should get profiles (profileList) ', async () => {
    const profiles = await Box.getProfiles(['0x12345'], boxOpts)
    expect(profiles['0x12345']).toEqual({
      name: 'zfer',
      email: 'zfer@mail.com'
    })
    expect(mockedUtils.fetchJson).toHaveBeenCalledWith('profile-server/profileList', { addressList: ['0x12345'] })
  })

  it('should be logged in', async () => {
    const isLoggedIn = Box.isLoggedIn('0xabcde')
    expect(isLoggedIn).toEqual(true)
  })

  it('should clear cache correctly', async () => {
    await box.logout()
    box = null
    box = await Box.openBox('0xabcde', 'web3prov', boxOpts)
    expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(1)
    await box._linkProfile()
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(1)
    await box.logout()
  })

  it('should be logged out', async () => {
    const isLoggedIn = Box.isLoggedIn('0xabcde')
    expect(isLoggedIn).toEqual(false)
  })

  it('should getProfile correctly when profile API is not used and box is not open', async () => {
    const profile = await Box.getProfile('0x12345', Object.assign(boxOpts, {useCacheService: false}))
    expect(profile).toEqual({
      name: 'oed',
      image: 'an awesome selfie'
    })
    expect(mockedUtils.fetchJson).toHaveBeenCalledWith('address-server/odbAddress/0x12345')
  })

  it('should verify profiles correctly', async () => {
    const profile = {
      proof_did: 'some proof',
      proof_github: 'github proof url',
      proof_twitter: 'twitter proof claim jwt'
    }
    let verifier = require('../utils/verifier')
    verifier.verifyDID.mockImplementationOnce(() => { throw new Error() })
    expect(Box.getVerifiedAccounts(profile)).rejects.toEqual(new Error())
    verifier.verifyDID.mockImplementationOnce(() => 'did:muport:Qmsdpuhs')
    verifier.verifyGithub.mockImplementationOnce(() => {
      return { username: 'test', proof: 'some url' }
    })
    verifier.verifyTwitter.mockImplementationOnce(() => {
      return { username: 'test', proof: 'some url' }
    })
    const verifiedAccounts = await Box.getVerifiedAccounts(profile)
    expect(verifiedAccounts).toEqual({ 'github': { 'proof': 'some url', 'username': 'test' }, 'twitter': { 'proof': 'some url', 'username': 'test' } })
  })
})
