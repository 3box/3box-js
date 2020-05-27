const ThreeId = require('../index')
const testUtils = require('../../__tests__/testUtils')
const localstorage = require('store')
const { verifyJWT } = require('did-jwt')
const { Resolver } = require('did-resolver')
const get3IdResolver = require('3id-resolver').getResolver
const IdentityWallet = require('identity-wallet')
const OdbStorage = require('orbit-db-storage-adapter')
const OdbKeystore = require('orbit-db-keystore')
const path = require('path')

const utils = require('../../utils/index')
utils.openBoxConsent = jest.fn(async () => '0x8726348762348723487238476238746827364872634876234876234')
utils.openSpaceConsent = jest.fn(async (a, b, space) => {
  return space === 'space1' ? '0x8ab87482987498387634985734987b9834598734597887070702535' : '0x8234be82987498387634985734987b9834598734597887070702535'
})
utils.sha256Multihash = jest.fn(str => {
  if (str === 'did:muport:Qmsdsdf87g329') return 'ab8c73d8f'
  return 'b932fe7ab'
})
utils.pad = x => x
utils.unpad = x => x

const STORAGE_KEY = 'serialized3id_'
const clearLocalStorage3id = (address) => {
  localstorage.remove(STORAGE_KEY + address)
}

const ID_WALLET_SEED = '0x95838ece1ac686bde68823b21ce9f564bc536eebb9c3500fa6da81f17086a6be'
const ADDR_1 = '0x12345'
const ADDR_2 = '0xabcde'
const ADDR_3 = '0xlmnop'
const ADDR_1_STATE_1 = '{"managementAddress":"0x12345","seed":"0xbc95bb0aeb7e5c7a9519ef066d4b60a944373ba1163b0c962a043bebec1579ef33e0ef4f63c0888d7a8ec95df34ada58fb739b2a4d3b44362747e6b193db9af2","spaceSeeds":{}}'
const ADDR_1_STATE_2 = '{"managementAddress":"0x12345","seed":"0xbc95bb0aeb7e5c7a9519ef066d4b60a944373ba1163b0c962a043bebec1579ef33e0ef4f63c0888d7a8ec95df34ada58fb739b2a4d3b44362747e6b193db9af2","spaceSeeds":{"space1":"0xedfac8a7bcc52f33b88cfb9f310bc533f77800183beecfa49dcdf8d3b4b906502ec46533d9d7fb12eced9b04e0bdebd1c26872cf5fa759331e4c2f97ab95f450","space2":"0x9dcc08a8813362b2188cf40216fbdff577f77c291e7b96cd8f31b60493a6b6a9572eee62b01fcb9a7759c12247cb57cc38e0b4e46e186c23d1d4b26db46108c7"}}'
const ADDR_2_STATE = '{"managementAddress":"0xabcde","seed":"0xbc95bb0aeb7e5c7a9519ef066d4b60a944373ba1163b0c962a043bebec1579ef33e0ef4f63c0888d7a8ec95df34ada58fb739b2a4d3b44362747e6b193db9af2","spaceSeeds":{}}'
const ADDR_3_STATE_1 = '{"managementAddress":"0xlmnop","seed":"0xaedd3b597a14ad1c941ca535208fabd0b44a668dd0c8156f68a823ef8d713212d356731839a354ac5b781f4b986ff54aa2cadfa3551846c9e43bfa0122f3d55b","spaceSeeds":{}}'
const SPACE_1 = 'space1'
const SPACE_2 = 'space2'
const ETHEREUM = 'mockEthProvider'
const CONTENT_SIGNATURE_1 = '0xsomeContentSignature'
const NOT_CONTENT_SIGNATURE_1 = '0xanIncorrectSignature'

const mockedUtils = require('../../utils/index')


describe('3id', () => {

  let threeId, ipfs, idw3id, keystore, resolver

  beforeAll(async () => {
    ipfs = await testUtils.initIPFS(6)
    const threeIdResolver = get3IdResolver(ipfs)
    resolver = new Resolver(threeIdResolver)
    const levelDown = OdbStorage(null, {})
    const keystorePath = path.join('./tmp', `/${utils.randInt(1000000)}`, '/keystore')
    const keyStorage = await levelDown.createStore(keystorePath)
    keystore = new OdbKeystore(keyStorage)
  })

  afterAll(async () => {
    await ipfs.stop()
  })

  beforeEach(() => {
    mockedUtils.openBoxConsent.mockClear()
    mockedUtils.openSpaceConsent.mockClear()
  })

  describe('getIdFromEthAddress', () => {
    it('should create a new identity on first call', async () => {
      const opts = { consentCallback: jest.fn() }
      threeId = await ThreeId.getIdFromEthAddress(ADDR_1, ETHEREUM, ipfs, keystore, opts)
      expect(threeId.serializeState()).toEqual(ADDR_1_STATE_1)
      expect(threeId.DID).toMatchSnapshot()
      expect(opts.consentCallback).toHaveBeenCalledWith(true)
      expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(1)
      expect(await resolver.resolve(threeId.DID)).toMatchSnapshot()
    })

    it('should create the same identity given the same address', async () => {
      // did is mocked, so compares serialized state
      const threeId1 = await ThreeId.getIdFromEthAddress('0xabcde1', ETHEREUM, ipfs, keystore)
      clearLocalStorage3id('0xabcde1')
      const threeId2 = await ThreeId.getIdFromEthAddress('0xABCDE1', ETHEREUM, ipfs, keystore)
      expect(threeId1.serializeState()).toEqual(threeId2.serializeState())
    })

    it('should create a new identity for other eth addr', async () => {
      const opts = { consentCallback: jest.fn() }
      threeId = await ThreeId.getIdFromEthAddress(ADDR_2, ETHEREUM, ipfs, keystore, opts)
      expect(threeId.serializeState()).toEqual(ADDR_2_STATE)
      expect(opts.consentCallback).toHaveBeenCalledWith(true)
      expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(1)
    })

    it('should get identity from storage on subsequent calls to existing identity', async () => {
      const opts = { consentCallback: jest.fn() }
      threeId = await ThreeId.getIdFromEthAddress(ADDR_1, ETHEREUM, ipfs, keystore, opts)
      expect(threeId.serializeState()).toEqual(ADDR_1_STATE_1)
      expect(opts.consentCallback).toHaveBeenCalledWith(false)
      expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(0)
    })

    it('should create a new identity when passed a contentSignature', async () => {
      const opts = { consentCallback: jest.fn(), contentSignature: CONTENT_SIGNATURE_1 }
      const contentSignatureThreeId = await ThreeId.getIdFromEthAddress(ADDR_3, ETHEREUM, ipfs, keystore, opts)
      expect(contentSignatureThreeId.serializeState()).toEqual(ADDR_3_STATE_1)
      expect(contentSignatureThreeId.DID).toMatchSnapshot()
      expect(opts.consentCallback).toHaveBeenCalledWith(true)
      expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(0)
      expect(await resolver.resolve(contentSignatureThreeId.DID)).toMatchSnapshot()
    })

    it('should create the same identity given the same address and contentSignature', async () => {
      // did is mocked, so compares serialized state
      const opts = { contentSignature: CONTENT_SIGNATURE_1 }
      const threeId1 = await ThreeId.getIdFromEthAddress(ADDR_3, ETHEREUM, ipfs, keystore, opts)
      clearLocalStorage3id(ADDR_3)
      const threeId2 = await ThreeId.getIdFromEthAddress(ADDR_3, ETHEREUM, ipfs, keystore, opts)
      expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(0)
      expect(threeId1.serializeState()).toEqual(threeId2.serializeState())
    })

    it('should NOT create the same identity given the same address but a different contentSignature', async () => {
      // did is mocked, so compares serialized state
      const opts = { contentSignature: NOT_CONTENT_SIGNATURE_1 }
      const threeId1 = await ThreeId.getIdFromEthAddress(ADDR_3, ETHEREUM, ipfs, keystore, opts)
      clearLocalStorage3id(ADDR_3)
      const threeId2 = await ThreeId.getIdFromEthAddress(ADDR_3, ETHEREUM, ipfs, keystore, opts)
      expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(0)
      expect(threeId1.serializeState()).not.toEqual(threeId2.serializeState())
    })

    describe('keyring logic', () => {
      it('should init space keyrings correctly', async () => {
        let authenticated = await threeId.isAuthenticated([SPACE_1])
        expect(authenticated).toEqual(false)
        await threeId.authenticate([SPACE_1])
        expect(mockedUtils.openSpaceConsent).toHaveBeenCalledTimes(1)
        expect(mockedUtils.openSpaceConsent).toHaveBeenCalledWith(ADDR_1, ETHEREUM, SPACE_1)
        let subDid = threeId.getSubDID(SPACE_1)
        expect(subDid).toMatchSnapshot()
        expect(await resolver.resolve(subDid)).toMatchSnapshot()

        authenticated = await threeId.isAuthenticated([SPACE_1])
        expect(authenticated).toEqual(true)
        authenticated = await threeId.isAuthenticated([SPACE_1, SPACE_2])
        expect(authenticated).toEqual(false)

        authenticated = await threeId.isAuthenticated([SPACE_2])
        expect(authenticated).toEqual(false)
        await threeId.authenticate([SPACE_2])
        expect(mockedUtils.openSpaceConsent).toHaveBeenCalledTimes(2)
        expect(mockedUtils.openSpaceConsent).toHaveBeenCalledWith(ADDR_1, ETHEREUM, SPACE_2)
        subDid = threeId.getSubDID(SPACE_2)
        expect(subDid).toMatchSnapshot()
        expect(await resolver.resolve(subDid)).toMatchSnapshot()

        authenticated = await threeId.isAuthenticated([SPACE_2])
        expect(authenticated).toEqual(true)
        authenticated = await threeId.isAuthenticated([SPACE_1, SPACE_2])
        expect(authenticated).toEqual(true)
      })

      it('should get public keys correctly', async () => {
        expect(await threeId.getPublicKeys(null, false)).toMatchSnapshot()
        expect(await threeId.getPublicKeys(SPACE_1, false)).toMatchSnapshot()
        expect(await threeId.getPublicKeys(null, true)).toMatchSnapshot()
        expect(await threeId.getPublicKeys(SPACE_1, true)).toMatchSnapshot()
      })

      it('should hashDBKey correctly', async () => {
        expect(await threeId.hashDBKey('somekey')).toMatchSnapshot()
        expect(await threeId.hashDBKey('somekey', SPACE_1)).toMatchSnapshot()
      })

      it('should encrypt and decrypt correctly', async () => {
        const message = 'test message'
        const enc1 = await threeId.encrypt(message)
        expect(await threeId.decrypt(enc1)).toEqual(message)
        const enc2 = await threeId.encrypt(message, SPACE_1)
        expect(await threeId.decrypt(enc2, SPACE_1)).toEqual(message)
        expect(await threeId.decrypt(enc1, SPACE_1)).toEqual(null)
      })

      it('should encrypt and decrypt asymmetrically correctly', async () => {
        const message = 'test message'
        const { asymEncryptionKey } = await threeId.getPublicKeys(SPACE_1)
        const enc1 = await threeId.encrypt(message, null, asymEncryptionKey)
        expect(await threeId.decrypt(enc1, SPACE_1)).toEqual(message)
        expect(await threeId.decrypt(enc1, SPACE_2)).toEqual(null)
      })

      it('should get identity with spaces automatically initialized', async () => {
        threeId = await ThreeId.getIdFromEthAddress(ADDR_1, ETHEREUM, ipfs, keystore)
        expect(threeId.serializeState()).toEqual(ADDR_1_STATE_2)
        expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(0)
      })
    })

    describe('claim signing', () => {
      it('should sign jwts correctly with rootDID', async () => {
        const jwt = await threeId.signJWT({
          iat: null,
          data: 'some data'
        })
        await expect(verifyJWT(jwt, { resolver })).resolves.toMatchSnapshot()
      })

      it('should sign jwts correctly with subDID', async () => {
        const jwt = await threeId.signJWT({
          iat: null,
          data: 'some data'
        }, { space: SPACE_1 })
        await expect(verifyJWT(jwt, { resolver, auth: true })).resolves.toMatchSnapshot()
      })
    })

    describe('login/out logic', () => {
      it('should be logged in', async () => {
        expect(ThreeId.isLoggedIn(ADDR_1)).toEqual(true)
      })

      it('should log out correctly', async () => {
        threeId.logout()
        expect(ThreeId.isLoggedIn(ADDR_1)).toEqual(false)
      })
    })
  })

  describe('get 3ID using IdentityWallet', () => {
    it('instantiate threeId with IdentityWallet', async () => {
      const idWallet = new IdentityWallet(() => true, { seed: ID_WALLET_SEED })
      const provider = idWallet.get3idProvider()
      idw3id = await ThreeId.getIdFromEthAddress(null, provider, ipfs, keystore)
      expect(idw3id.DID).toBeUndefined()
      await idw3id.authenticate()
      expect(idw3id.DID).toMatchSnapshot()
      expect(await idw3id.getPublicKeys()).toMatchSnapshot()
      expect(await idw3id.getPublicKeys(null, true)).toMatchSnapshot()
      expect(await resolver.resolve(idw3id.DID)).toMatchSnapshot()
    })

    describe('keyring logic', () => {
      it('should init space keyrings correctly', async () => {
        await idw3id.authenticate([SPACE_1])
        let subDid = idw3id.getSubDID(SPACE_1)
        expect(subDid).toMatchSnapshot()
        expect(await resolver.resolve(subDid)).toMatchSnapshot()

        await idw3id.authenticate([SPACE_2])
        subDid = idw3id.getSubDID(SPACE_2)
        expect(subDid).toMatchSnapshot()
        expect(await resolver.resolve(subDid)).toMatchSnapshot()
      })

      it('should get public keys correctly', async () => {
        expect(await idw3id.getPublicKeys(null, false)).toMatchSnapshot()
        expect(await idw3id.getPublicKeys(SPACE_1, false)).toMatchSnapshot()
        expect(await idw3id.getPublicKeys(null, true)).toMatchSnapshot()
        expect(await idw3id.getPublicKeys(SPACE_1, true)).toMatchSnapshot()
      })

      it('should hashDBKey correctly', async () => {
        expect(await idw3id.hashDBKey('somekey')).toMatchSnapshot()
        expect(await idw3id.hashDBKey('somekey', SPACE_1)).toMatchSnapshot()
      })

      it('should encrypt and decrypt correctly', async () => {
        const message = 'test message'
        const enc1 = await idw3id.encrypt(message)
        expect(await idw3id.decrypt(enc1)).toEqual(message)
        const enc2 = await idw3id.encrypt(message, SPACE_1)
        expect(await idw3id.decrypt(enc2, SPACE_1)).toEqual(message)
        await expect(idw3id.decrypt(enc1, SPACE_1)).rejects.toMatchSnapshot()
      })

      it('should encrypt and decrypt asymmetrically correctly', async () => {
        const message = 'test message'
        const { asymEncryptionKey } = await idw3id.getPublicKeys(SPACE_1)
        const enc1 = await idw3id.encrypt(message, null, asymEncryptionKey)
        expect(await idw3id.decrypt(enc1, SPACE_1)).toEqual(message)
        await expect(idw3id.decrypt(enc1, SPACE_2)).rejects.toMatchSnapshot()
      })
    })

    describe('claim signing', () => {
      it('should sign jwts correctly with rootDID', async () => {
        const jwt = await idw3id.signJWT({
          iat: null,
          data: 'some data'
        })
        await expect(verifyJWT(jwt, { resolver })).resolves.toMatchSnapshot()
      })

      it('should sign jwts correctly with subDID', async () => {
        const jwt = await idw3id.signJWT({
          iat: null,
          data: 'some data'
        }, { space: SPACE_1 })
        await expect(verifyJWT(jwt, { resolver, auth: true })).resolves.toMatchSnapshot()
      })
    })
  })
})
