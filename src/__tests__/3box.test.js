const testUtils = require('./testUtils')
const OrbitDB = require('orbit-db')
const Pubsub = require('orbit-db-pubsub')
const jsdom = require('jsdom')
const didJWT = require('did-jwt')
const Box = require('../3box')
global.window = new jsdom.JSDOM().window
const { registerMethod } = require('did-resolver')
const AccessControllers = require('orbit-db-access-controllers')
const { LegacyIPFS3BoxAccessController } = require('3box-orbitdb-plugins')
AccessControllers.addAccessController({ AccessController: LegacyIPFS3BoxAccessController })
const { threeIDMockFactory, didResolverMock } = require('../__mocks__/3ID')

registerMethod('3', didResolverMock)

const DID1 = 'did:3:zdpuAsaK9YsqpphSBeQvfrKAjs8kF7vUX4Y3kMkMRgEQigzCt'
const DID2 = 'did:3:zdpuB2DcKQKNBDz3difEYxjTupsho5VuPCLgRbRunXqhmrJaX'
const DIDMUPORT1 = DID1.replace('3', 'muport')
const DIDMUPORT2 = DID2.replace('3', 'muport')


const randomStr = () => `${Math.floor(Math.random() * 1000000)}`


jest.mock('../3id', () => {
  const randomStr = () => `${Math.floor(Math.random() * 1000000)}`
  const { threeIDMockFactory, didResolverMock } = require('../__mocks__/3ID')
  const DID1 = 'did:3:zdpuAsaK9Ysqpph'
  const DID2 = 'did:3:zdpuB2DcKQKNBDz3d'
  let loggedIn = true
  const logoutFn = jest.fn(() => {
    loggedIn = false
  })
  const instance = (did, managementKey) => {
    const instance = threeIDMockFactory(did)
    const extend = {
      muportDID: did.replace('3', 'muport'),
      managementAddress: managementKey,
      logout: logoutFn,
      // muportFingerprint: managementKey === '0x12345' ? 'b932fe7ab' : 'ab8c73d8f',
      muportFingerprint: randomStr(),
      getDidDocument: () => { return { managementKey } },
    }
    return Object.assign(instance, extend)
  }
  return {
    getIdFromEthAddress: jest.fn((address, ethProv, ipfs, { consentCallback }) => {
      // const did = address === '0x12345' ? DID1 : DID2
      const did = `did:3:${randomStr()}`
      return instance(did, address)
    }),
    logoutFn,
    isLoggedIn: jest.fn(() => { return loggedIn })
   }
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
jest.mock('../space', () => {
  return jest.fn(name => {
    return {
      _name: name,
      open: jest.fn()
    }
  })
})


jest.mock('../utils/verifier')
jest.mock('../utils/index', () => {
  const actualUtils = jest.requireActual('../utils/index')
  const sha256 = require('js-sha256').sha256
  let addressMap = {}
  let linkmap = {}
  let linkNum = 0
  return {
    getMessageConsent: actualUtils.getMessageConsent,
    recoverPersonalSign: () => '0x8726348762348723487238476238746827364872634876234876234',
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
          if (linkNum < 3) {
            linkNum += 1
            return Promise.reject('{ status: "error", message: "an error" }')
          } else {
            did = body.message.split(',')[1]
            const address = body.signature.split(',')[1]
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
        sig: '0xSuchRealSig,' + address,
        timestamp: 111
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
const mocked3id = require('../3id')
const MOCK_HASH_SERVER = 'address-server'
const MOCK_PROFILE_SERVER = 'profile-server'

describe('3Box', () => {
  let ipfs, pubsub, boxOpts, ipfsBox, box, boxWithLinks
  jest.setTimeout(30000)

  const clearMocks = () => {
    mockedUtils.openBoxConsent.mockClear()
    mockedUtils.fetchJson.mockClear()
    mockedUtils.getLinkConsent.mockClear()
    mocked3id.getIdFromEthAddress.mockClear()
    mocked3id.logoutFn.mockClear()
  }

  beforeAll(async () => {
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
      ipfsBox = await testUtils.initIPFS(1)
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

  })

  beforeEach(async () => {
    clearMocks()
  })

  afterAll(async () => {
    await pubsub.disconnect()
    await box.close()
    await testUtils.stopIPFS(ipfs, 0)
    await testUtils.stopIPFS(ipfsBox, 1)
  })

  it('should openBox correctly', async () => {
    const addr = '0x12345'
    const prov = 'web3prov'
    const consentCallback = jest.fn()
    const opts = { ...boxOpts, consentCallback }
    const box = await Box.openBox(addr, prov, opts)

    const publishPromise = new Promise((resolve, reject) => {
      pubsub.subscribe('3box-pinning', (topic, data) => {
        expect(data.odbAddress).toEqual(box._rootStore.address.toString())
        resolve()
      }, () => {})
    })

    expect(box.public._load).toHaveBeenCalledTimes(1)
    expect(box.public._load).toHaveBeenCalledWith()
    expect(box.private._load).toHaveBeenCalledTimes(1)
    expect(box.private._load).toHaveBeenCalledWith()
    expect(mocked3id.getIdFromEthAddress).toHaveBeenCalledTimes(1)
    expect(mocked3id.getIdFromEthAddress).toHaveBeenCalledWith(addr, prov, boxOpts.ipfs, opts)
    await publishPromise

    const syncPromise = new Promise((resolve, reject) => { box.onSyncDone(resolve) })
    pubsub.publish('3box-pinning', { type: 'HAS_ENTRIES', odbAddress: '/orbitdb/Qmasdf/08a7.public', numEntries: 4 })
    pubsub.publish('3box-pinning', { type: 'HAS_ENTRIES', odbAddress: '/orbitdb/Qmfdsa/08a7.private', numEntries: 5 })
    await syncPromise
    expect(mockedUtils.fetchJson).toHaveBeenCalledTimes(1)
    expect(mockedUtils.fetchJson.mock.calls[0][0]).toEqual('address-server/odbAddress')
    expect(didJWT.decodeJWT(mockedUtils.fetchJson.mock.calls[0][1].address_token).payload.rootStoreAddress).toEqual(box._rootStore.address.toString())

    pubsub.unsubscribe('3box-pinning')
    await box.close()
  })

  // it('should sync db updates to/from remote pinning server', async () => {
  //   const addr = '0x12345'
  //   const prov = 'web3prov'
  //   const consentCallback = jest.fn()
  //   const opts = { ...boxOpts, consentCallback }
  //   const box = await Box.openBox(addr, prov, opts)
  //
  //
  //   const orbitdb = await OrbitDB.createInstance(ipfs, {
  //     directory:'./tmp/orbitdb3',
  //   })
  //   const rootStoreAddress = box._rootStore.address.toString()
  //   const store = await orbitdb.open(rootStoreAddress, {
  //     accessController: {
  //       type: 'legacy-ipfs-3box',
  //       skipManifest: true
  //     }
  //   })
  //   await new Promise((resolve, reject) => {
  //     store.events.on('replicate.progress', (_x, _y, _z, num, max) => {
  //       if (num === max) resolve()
  //     })
  //   })
  //
  //   await box._rootStore.drop()
  //   await box.close()
  //   const publishPromise = new Promise((resolve, reject) => {
  //     pubsub.subscribe('3box-pinning', (topic, data) => {
  //       // expect(data.odbAddress).toMatchSnapshot()
  //       resolve()
  //     }, (topic, peer) => {
  //       pubsub.publish('3box-pinning', { type: 'HAS_ENTRIES', odbAddress: '/orbitdb/Qmasdf/08a7.public', numEntries: 4 })
  //       pubsub.publish('3box-pinning', { type: 'HAS_ENTRIES', odbAddress: '/orbitdb/Qmfdsa/08a7.private', numEntries: 5 })
  //     })
  //   })
  //
  //   const box2 = await Box.openBox('0x12345', 'web3prov', boxOpts)
  //
  //   box2.public.get.mockImplementationOnce(() => 'did proof JWT')
  //   const syncPromise = new Promise((resolve, reject) => { box.onSyncDone(resolve) })
  //   await syncPromise
  //   expect(box2.public.set).toHaveBeenCalledTimes(0)
  //
  //   expect(box2.public._sync).toHaveBeenCalledTimes(1)
  //   expect(box2.public._sync).toHaveBeenCalledWith(4)
  //   expect(box2.private._sync).toHaveBeenCalledTimes(1)
  //   expect(box2.private._sync).toHaveBeenCalledWith(5)
  //   expect(mockedUtils.fetchJson).toHaveBeenCalledTimes(1)
  //   await publishPromise
  //   pubsub.unsubscribe('3box-pinning')
  //   await orbitdb.stop()
  //   // await box.close()
  //   await box2.close()
  // })

  it('should open spaces correctly', async () => {
    const box = await Box.openBox('0x12345','web3prov', boxOpts)

    clearMocks()

    global.console.error = jest.fn()
    let space1 = await box.openSpace('name1', {})
    expect(space1._name).toEqual('name1')
    expect(space1.open).toHaveBeenCalledWith(expect.any(Object))
    let opts = { onSyncDone: jest.fn() }
    let space2 = await box.openSpace('name1', opts)
    expect(space1).toEqual(space2)
    expect(opts.onSyncDone).toHaveBeenCalledTimes(1)
    // TODO why opening two spaces causes problem????
    // let space3 = await box.openSpace('name2', 'myOpts')
    // expect(box.spaces).toEqual({
    //   name1: space1,
    //   name2: space3
    // })

    await box.close()
  })

  it.skip('ensurePinningNodeConnected should not do anything if already connected to given pubsub room', async () => {
    // TODO - can't get this test to work. Not sure what changed.
    // Anyway the 3box client thinks it's connected to the ipfs node
    // in the test, while the test thinks it's not connected to the client
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
    const box = await Box.openBox('0x12345','web3prov', boxOpts)
    const didMuPort = box._3id.muportDID
    const did = box._3id.DID
    clearMocks()

    // first two calls in our mock will throw an error
    box.public.get = jest.fn()
    global.console.error = jest.fn()
    box.public.set.mockClear()
    await box._linkProfile()

    expect(box.public.set).toHaveBeenCalledTimes(1) //  proof

    // It will check the self-signed did
    expect(box.public.get).toHaveBeenNthCalledWith(1, 'proof_did')
    // expect(box.public.set).toHaveBeenNthCalledWith(1, 'proof_did', 'veryJWT,did:muport:Qmsdfp98yw4t7', { noLink: true })
    expect(box.public.set.mock.calls[0][0]).toEqual('proof_did')
    expect(didJWT.decodeJWT(box.public.set.mock.calls[0][1]).payload.iss).toEqual(did)
    await new Promise((resolve, reject) => { setTimeout(resolve, 500) })
    expect(global.console.error).toHaveBeenCalledTimes(1)
    expect(mockedUtils.fetchJson).toHaveBeenCalledTimes(1)
    expect(mockedUtils.fetchJson).toHaveBeenNthCalledWith(1, 'address-server/link', {
      message: `I agree to stuff,${didMuPort}`,
      signature: "0xSuchRealSig,0x12345",
      timestamp: 111,
      type: "ethereum-eoa",
      version: 1,
    })
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(1)

    await box.close()
  })

  it('should not call getLinkConsent if ethereum_proof in rootStore on call to _linkProfile', async () => {
    const boxWithLinks = await Box.openBox('0xabcdef', 'web3prov', boxOpts)
    clearMocks()

    boxWithLinks.public.get = jest.fn((key) => {
      if (key === 'proof_did') return 'proof-did'
      return null
    })

    boxWithLinks._readAddressLink = jest.fn(() => {
      return {
        message: `I agree to stuff,${DIDMUPORT1}`,
        signature: "0xSuchRealSig,0x12345",
        timestamp: 111,
        type: "ethereum-eoa",
        version: 1,
      }
    })

    // first two calls in our mock will throw an error
    boxWithLinks.public.set.mockClear()

    global.console.error = jest.fn()
    await boxWithLinks._linkProfile()
    await new Promise((resolve, reject) => { setTimeout(resolve, 500) })
    expect(global.console.error).toHaveBeenCalledTimes(1)
    expect(mockedUtils.fetchJson).toHaveBeenCalledTimes(1)
    // TODO now hwy this second clal as expected??
    expect(mockedUtils.fetchJson).toHaveBeenNthCalledWith(1, 'address-server/link', {
      message: `I agree to stuff,${DIDMUPORT1}`,
      signature: "0xSuchRealSig,0x12345",
      timestamp: 111,
      type: "ethereum-eoa",
      version: 1,
    })
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(0)
    expect(boxWithLinks.public.set).toHaveBeenCalledTimes(0)

    await boxWithLinks.close()
  })


  it('should link profile on call to _linkProfile', async () => {
    const box = await Box.openBox('0x12345', 'web3prov', boxOpts)
    const didMuPort = box._3id.muportDID
    clearMocks()

    box.public.set.mockClear()
    box.public.get = jest.fn()
    await box._linkProfile()

    expect(mockedUtils.fetchJson).toHaveBeenCalledTimes(1)
    expect(mockedUtils.fetchJson).toHaveBeenNthCalledWith(1, 'address-server/link', {
      message: `I agree to stuff,${didMuPort}`,
      signature: "0xSuchRealSig,0x12345",
      timestamp: 111,
      type: "ethereum-eoa",
      version: 1,
    })
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(1)
    expect(box.public.set).toHaveBeenCalledTimes(1) // did proof
    await box.close()
  })

  it('should not recompute link data for profile on second call to _linkProfile', async () => {
    const boxWithLinks = await Box.openBox('0xabcde', 'web3prov', boxOpts)

    const didMuPort = boxWithLinks._3id.muportDID
    clearMocks()

    boxWithLinks.public.get = jest.fn((key) => {
      if (key === 'proof_did') return 'proof-did'
      return null
    })

    boxWithLinks._readAddressLink = jest.fn(() => {
      return {
        message: `I agree to stuff,${didMuPort}`,
        signature: "0xSuchRealSig,0x12345",
        timestamp: 111,
        type: "ethereum-eoa",
        version: 1,
      }
    })

    boxWithLinks.public.set.mockClear()
    boxWithLinks.public.get
      .mockImplementationOnce(x => {
        if (x === 'proof_did') {
          return Promise.resolve('thisissomeproof')
        } else {
          throw new Error('Mock invalid')
        }
      })

    await boxWithLinks._linkProfile()
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(0) // do not recompute
    expect(mockedUtils.fetchJson).toHaveBeenCalledTimes(1) // do re-link the profile
    expect(boxWithLinks.public.set).toHaveBeenCalledTimes(0) // do no update data we already know

    await boxWithLinks.close()
  })

  it('should handle a second address/account correctly', async () => {
    const box = await Box.openBox('0x12345', 'web3prov', boxOpts)
    await box.close()
    clearMocks()

    const box2 = await Box.openBox('0xabcde', 'web3prov', boxOpts)
    const didMuPort2 = box2._3id.muportDID

    const publishPromise = new Promise((resolve, reject) => {
      pubsub.subscribe('3box-pinning', (topic, data) => {
        expect(data.odbAddress).toEqual(box2._rootStore.address.toString())
        resolve()
      }, () => {})
    })

    expect(box2.public._load).toHaveBeenCalledTimes(1)
    expect(box2.public._load).toHaveBeenCalledWith()
    expect(box2.private._load).toHaveBeenCalledTimes(1)
    expect(box2.private._load).toHaveBeenCalledWith()
    expect(mocked3id.getIdFromEthAddress).toHaveBeenCalledTimes(1)
    expect(mocked3id.getIdFromEthAddress).toHaveBeenCalledWith('0xabcde', 'web3prov', boxOpts.ipfs, boxOpts)

    await box2._linkProfile()
    expect(mockedUtils.fetchJson).toHaveBeenCalledTimes(2)
    expect(mockedUtils.fetchJson).toHaveBeenNthCalledWith(2, 'address-server/link', {
      message: `I agree to stuff,${didMuPort2}`,
      signature: "0xSuchRealSig,0xabcde",
      timestamp: 111,
      type: "ethereum-eoa",
      version: 1,
    })
    expect(mockedUtils.getLinkConsent).toHaveBeenCalledTimes(1)
    await publishPromise
    expect(mockedUtils.fetchJson).toHaveBeenCalledTimes(2)
    expect(mockedUtils.fetchJson.mock.calls[0][0]).toEqual('address-server/odbAddress')
    expect(didJWT.decodeJWT(mockedUtils.fetchJson.mock.calls[0][1].address_token).payload.rootStoreAddress).toEqual(box2._rootStore.address.toString())
    pubsub.unsubscribe('3box-pinning')
    box2.close()
  })

  it.skip('should getProfile correctly (when profile API is not used)', async () => {
    // Disabled this for now. I don't think the way we get profiles
    // though orbitdb right now makes sense anyway. In the future
    // we propbably want to have a stateful api for getting and following
    // other users.
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
    delete boxOpts.useCacheService
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
    expect(mockedUtils.fetchJson)
      .toHaveBeenCalledWith('profile-server/profileList', { addressList: ['0x12345'], didList: [] })
  })

  it('should be logged in', async () => {
    const isLoggedIn = Box.isLoggedIn('0xabcde')
    expect(isLoggedIn).toEqual(true)
  })

  it('should clear cache correctly', async () => {
    const box = await Box.openBox('0x12345', 'web3prov', boxOpts)
    await box.logout()
    expect(mocked3id.logoutFn).toHaveBeenCalledTimes(1)
    await box.close()
  })

  it('should be logged out', async () => {
    const box = await Box.openBox('0x12345', 'web3prov', boxOpts)
    await box.logout()
    const isLoggedIn = Box.isLoggedIn('0xabcde')
    expect(isLoggedIn).toEqual(false)
    await box.close()
  })

  it.skip('should getProfile correctly when profile API is not used and box is not open', async () => {
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
    const userDID = 'did:muport:Qmsdpuhs'

    let verifier = require('../utils/verifier')

    verifier.verifyDID.mockImplementationOnce(() => { throw new Error() })
    expect(await Box.getVerifiedAccounts(profile)).toEqual({})

    verifier.verifyDID.mockImplementationOnce(() => userDID)
    verifier.verifyGithub.mockImplementationOnce(() => {
      return { username: 'test', proof: 'some url' }
    })
    verifier.verifyTwitter.mockImplementationOnce(() => {
      return { username: 'test', proof: 'some url' }
    })

    const verifiedAccounts = await Box.getVerifiedAccounts(profile)
    expect(verifiedAccounts).toEqual({
      'github': { 'proof': 'some url', 'username': 'test' },
      'twitter': { 'proof': 'some url', 'username': 'test' },
      'did': userDID
    })
  })

  describe('verify eth', () => {
    let verifier = jest.requireActual('../utils/verifier')

    const ethProof = {
      consent_msg: 'Create a new 3Box profile\n\n- \nYour unique profile ID is did:muport:Qmb9E8wLqjfAqfKhideoApU5g26Yz2Q2bSp6MSZmc5WrNr',
      consent_signature: '0x851554733a2989555233f1845ae1a9a7a80cd080afa2cde9a5ccc21b98f0438317fed99955d1d9b32d7f94adae500e36c508a8fe976614088ad6026831f0e3261b',
      linked_did: 'did:muport:Qmb9E8wLqjfAqfKhideoApU5g26Yz2Q2bSp6MSZmc5WrNr'
    }

    const did = 'did:muport:Qmb9E8wLqjfAqfKhideoApU5g26Yz2Q2bSp6MSZmc5WrNr'

    const ethKey = '0x70509CAAf30Cd92D5f14ddcf98e84e1b38F10a4d'

    it('should verify a regular eth profile', async () => {
      const verif = await verifier.verifyEthereum(ethProof, did)
      expect(verif).toEqual(ethKey)
    })

    it('should fail if you try to spoof another address', async () => {
      // We generate a different message and sign it from another wallet.
      const fakeProof = {
        consent_msg: 'Create a new 3Box profile\n\n-\n Your unique profile ID is did:muport:Qmb9E8wLqjfAqfKhideoApU5g26Yz2Q2bSp6MSZmc5WrNw',
        consent_signature: '0x1928698128a06d5a2005beaca13c42741254279a8759ce83aa16008713742e23038bc6183295f807dc1f475594094301ef02c7cf07eb319d1de08e3dae7aba9f1c',
        linked_did: 'did:muport:Qmb9E8wLqjfAqfKhideoApU5g26Yz2Q2bSp6MSZmc5WrNr'
      }

      try {
        const verif = await verifier.verifyEthereum(fakeProof, did)
        expect('should have failed and throw, but we got:').toEqual(verif)
      } catch (e) {
        expect(true).toBeTruthy()
      }
    })
  })
})
