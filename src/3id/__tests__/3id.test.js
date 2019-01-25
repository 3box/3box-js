const ThreeId = require('../index')

jest.mock('../../utils/index', () => {
  const sha256 = require('js-sha256').sha256
  return {
    openBoxConsent: jest.fn(async () => '0x8726348762348723487238476238746827364872634876234876234'),
    openSpaceConsent: jest.fn(async () => '0x8ab87482987498387634985734987b9834598734597887070702535'),
    sha256Multihash: jest.fn(str => {
      if (str === 'did:muport:Qmsdsdf87g329') return 'ab8c73d8f'
      return 'b932fe7ab'
    }),
    sha256
  }
})

jest.mock('muport-core', () => {
  const did1 = 'did:muport:Qmsdfp98yw4t7'
  const did2 = 'did:muport:Qmsdsdf87g329'
  const instance = (did, managementKey) => {
    return {
      serializeState: () => { return { did, managementKey } },
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
    return instance(serializeState.did, serializeState.managementKey)
  }
  MuPort.newIdentity = (p, d, { externalMgmtKey }) => {
    const did = externalMgmtKey === '0x12345' ? did1 : did2
    return instance(did, externalMgmtKey)
  }
  return MuPort
})

const ADDR_1 = '0x12345'
const ADDR_2 = '0xabcde'
const ADDR_1_STATE_1 = '{"managementAddress":"0x12345","seed":"0xbc95bb0aeb7e5c7a9519ef066d4b60a944373ba1163b0c962a043bebec1579ef33e0ef4f63c0888d7a8ec95df34ada58fb739b2a4d3b44362747e6b193db9af2","spaceSeeds":{},"muport":{"did":"did:muport:Qmsdfp98yw4t7","managementKey":"0x12345"}}'
const ADDR_1_STATE_2 = '{"managementAddress":"0x12345","seed":"0xbc95bb0aeb7e5c7a9519ef066d4b60a944373ba1163b0c962a043bebec1579ef33e0ef4f63c0888d7a8ec95df34ada58fb739b2a4d3b44362747e6b193db9af2","spaceSeeds":{"space1":"0xedfac8a7bcc52f33b88cfb9f310bc533f77800183beecfa49dcdf8d3b4b906502ec46533d9d7fb12eced9b04e0bdebd1c26872cf5fa759331e4c2f97ab95f450","space2":"0xedfac8a7bcc52f33b88cfb9f310bc533f77800183beecfa49dcdf8d3b4b906502ec46533d9d7fb12eced9b04e0bdebd1c26872cf5fa759331e4c2f97ab95f450"},"muport":{"did":"did:muport:Qmsdfp98yw4t7","managementKey":"0x12345"}}'
const ADDR_2_STATE = '{"managementAddress":"0xabcde","seed":"0xbc95bb0aeb7e5c7a9519ef066d4b60a944373ba1163b0c962a043bebec1579ef33e0ef4f63c0888d7a8ec95df34ada58fb739b2a4d3b44362747e6b193db9af2","spaceSeeds":{},"muport":{"did":"did:muport:Qmsdsdf87g329","managementKey":"0xabcde"}}'
const SPACE_1 = 'space1'
const SPACE_2 = 'space2'
const ETHEREUM = 'mockEthProvider'

const mockedUtils = require('../../utils/index')

describe('3id', () => {

  let threeId

  beforeEach(() => {
    mockedUtils.openBoxConsent.mockClear()
    mockedUtils.openSpaceConsent.mockClear()
  })

  describe('getIdFromEthAddress', () => {
    it('should create a new identity on first call', async () => {
      const opts = { consentCallback: jest.fn() }
      threeId = await ThreeId.getIdFromEthAddress(ADDR_1, ETHEREUM, opts)
      expect(threeId.serializeState()).toEqual(ADDR_1_STATE_1)
      expect(opts.consentCallback).toHaveBeenCalledWith(true)
      expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(1)
    })

    it('should create a new identity for other eth addr', async () => {
      const opts = { consentCallback: jest.fn() }
      threeId = await ThreeId.getIdFromEthAddress(ADDR_2, ETHEREUM, opts)
      expect(threeId.serializeState()).toEqual(ADDR_2_STATE)
      expect(opts.consentCallback).toHaveBeenCalledWith(true)
      expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(1)
    })

    it('should get identity from storage on subsequent calls to existing identity', async () => {
      const opts = { consentCallback: jest.fn() }
      threeId = await ThreeId.getIdFromEthAddress(ADDR_1, ETHEREUM, opts)
      expect(threeId.serializeState()).toEqual(ADDR_1_STATE_1)
      expect(opts.consentCallback).toHaveBeenCalledWith(false)
      expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(0)
    })
  })

  describe('keyring logic', () => {
    it('should get main keyring using rootStore/public/private name', async () => {
      const fingerprint = threeId.muportFingerprint
      let kr = threeId.getKeyringBySpaceName(fingerprint + '.root')
      expect(kr._seed).toEqual(JSON.parse(ADDR_1_STATE_1).seed)
      kr = threeId.getKeyringBySpaceName(fingerprint + '.public')
      expect(kr._seed).toEqual(JSON.parse(ADDR_1_STATE_1).seed)
      kr = threeId.getKeyringBySpaceName(fingerprint + '.private')
      expect(kr._seed).toEqual(JSON.parse(ADDR_1_STATE_1).seed)
    })

    it('should init space keyrings correctly', async () => {
      let requiredConsent = await threeId.initKeyringByName(SPACE_1)
      expect(requiredConsent).toEqual(true)
      expect(mockedUtils.openSpaceConsent).toHaveBeenCalledTimes(1)
      expect(mockedUtils.openSpaceConsent).toHaveBeenCalledWith(ADDR_1, ETHEREUM, SPACE_1)

      requiredConsent = await threeId.initKeyringByName(SPACE_2)
      expect(requiredConsent).toEqual(true)
      expect(mockedUtils.openSpaceConsent).toHaveBeenCalledTimes(2)
      expect(mockedUtils.openSpaceConsent).toHaveBeenCalledWith(ADDR_1, ETHEREUM, SPACE_2)

      requiredConsent = await threeId.initKeyringByName(SPACE_2)
      expect(requiredConsent).toEqual(false)
      expect(mockedUtils.openSpaceConsent).toHaveBeenCalledTimes(2)
    })

    it('should get space keyrings correctly', async () => {
      let kr = threeId.getKeyringBySpaceName(`3box.space.${SPACE_1}.keyvalue`)
      expect(kr._seed).toEqual(JSON.parse(ADDR_1_STATE_2).spaceSeeds[SPACE_1])
      kr = threeId.getKeyringBySpaceName(`3box.space.${SPACE_2}.keyvalue`)
      expect(kr._seed).toEqual(JSON.parse(ADDR_1_STATE_2).spaceSeeds[SPACE_2])
    })

    it('should get identity with spaces automatically initialized', async () => {
      threeId = await ThreeId.getIdFromEthAddress(ADDR_1, ETHEREUM)
      expect(threeId.serializeState()).toEqual(ADDR_1_STATE_2)
      expect(mockedUtils.openBoxConsent).toHaveBeenCalledTimes(0)
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

