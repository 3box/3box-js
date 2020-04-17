const mockAccount1 = {
  did: 'did:3:bafyreihehemyps4kjadxpz3wfdonb7d3frohn6hjra337zw6wm3s6z5x5a',
  address: '0x281f8bce74d292d8c0d866d6ea69d9282ae3fe7c',
  proof: {
    type: "ethereum-eoa",
    address: "0x281f8bce74d292d8c0d866d6ea69d9282ae3fe7c",
    message: "Create a new 3Box profile - Your unique profile ID is did:3:bafyreihehemyps4kjadxpz3wfdonb7d3frohn6hjra337zw6wm3s6z5x5a Timestamp: 1586854656",
    version: 1,
    signature: "0x184969d6514c2b9e257940b4c8cac87e90ca07a26807437037aeba68b2f90b8116387ddcbaf0e01dd1a808c73ec4eeb957372b66c365db21552cbe4a880189961c",
    timestamp: 1586854656
  }
}

const mockAccount2 = {
  did: 'did:3:bafyreiaetxjnsuiml34v7enotmxdngorieo6ooxjxkurap4k2ohoynxwuq',
  address: '0xa4b5be72024fba206e895056a71938955fed7226',
  proof: {
    type: "ethereum-eoa",
    address: "0xa4b5be72024fba206e895056a71938955fed7226",  
    message: "Create a new 3Box profile - Your unique profile ID is did:3:bafyreiaetxjnsuiml34v7enotmxdngorieo6ooxjxkurap4k2ohoynxwuq Timestamp: 1586858254",
    version: 1,
    signature: "0x6381d27d57bee8448b380ea619192f105ab02cbd0a70f4c52c5f99dcef7606e9298f6adb4536faaa033e5403cc1f9b339bf1b87ff59ba34f20da3680b03bb2ce1b",
    timestamp: 1586858254
  }
}

jest.mock('3id-blockchain-utils', () => ({
  createLink: jest.fn(async (did, address, provider) => (mockAccount1.proof))
}))


const AccountLinks = require('../accountLinks')
const cloneDeep = require('lodash.clonedeep')

describe('AccountLinks', () => {
  const mockProvider = jest.fn()
  const mockDocument = {
    change: jest.fn(),
    id: '/ceramic/bafyreiekd7xj4zungivvamff5pfu7vnf7xroreeaxowntjjilcfwf7d4mq',
  }
  const mockCeramic = {
    createDocument: jest.fn(async () => mockDocument),
  }

  let accountLinks

  beforeEach(() => {
    jest.clearAllMocks()
    accountLinks = new AccountLinks(mockCeramic, mockProvider)
  })

  describe('create', () => {
    it('should create a ceramic account-link document with the given proof', async() => {
      await accountLinks.create(mockAccount2.address, mockAccount2.did, mockAccount2.proof)

      expect(mockCeramic.createDocument).toHaveBeenCalledWith(null, 'account-link', { owners: [mockAccount2.address + '@eip155:1'], onlyGenesis: true })
      expect(mockDocument.change).toHaveBeenCalledWith(mockAccount2.proof)
    })

    it('should create a ceramic document with a generated proof if no proof provided', async () => {
      await accountLinks.create(mockAccount1.address, mockAccount1.did)

      expect(mockCeramic.createDocument).toHaveBeenCalledWith(null, 'account-link', { owners: [mockAccount1.address + '@eip155:1'], onlyGenesis: true })
      expect(mockDocument.change).toHaveBeenCalledWith(mockAccount1.proof)
    })

    it('should throw an error if no provider is defined and no proof given', async () => {
      accountLinks = new AccountLinks(mockCeramic, null)

      const resultPromise = accountLinks.create(mockAccount1.address, mockAccount1.did)

      await expect(resultPromise).rejects.toThrow(/Provider must be set/i)
    })

    it('should update the account link if it already exists and has a different did', async () => {
      const mockDocumentWithContent = cloneDeep(mockDocument)
      mockDocumentWithContent.content = mockAccount1.did
      mockCeramic.createDocument.mockImplementation(async () => mockDocumentWithContent)

      await accountLinks.create(mockAccount2.address, mockAccount2.did, mockAccount2.proof)

      expect(mockDocumentWithContent.change).toHaveBeenCalledWith(mockAccount2.proof)
    })

    it('should do nothing if the account link already exists and has the same did', async () => {
      const mockDocumentWithContent = cloneDeep(mockDocument)
      mockDocumentWithContent.content = mockAccount2.did
      mockCeramic.createDocument.mockImplementation(async () => mockDocumentWithContent)

      await accountLinks.create(mockAccount2.address, mockAccount2.did, mockAccount2.proof)

      expect(mockDocumentWithContent.change).not.toHaveBeenCalled()
    })
  })

  describe('read', async () => {
    it('should return the DID of the given address if the ceramic document exists', async () => {
      const mockDocumentWithContent = cloneDeep(mockDocument)
      mockDocumentWithContent.content = mockAccount1.did
      mockCeramic.createDocument.mockImplementation(async () => mockDocumentWithContent)

      const actual = await accountLinks.read(mockAccount1.address)

      expect(actual).toEqual(mockAccount1.did)
      expect(mockCeramic.createDocument).toHaveBeenCalledWith(null, 'account-link', { owners: [mockAccount1.address + '@eip155:1'], onlyGenesis: true })
    })
  })

  describe('update', async () => {
    it('should update a ceramic account-link document with the given proof', async() => {
      await accountLinks.update(mockAccount2.address, mockAccount2.did, mockAccount2.proof)

      expect(mockCeramic.createDocument).toHaveBeenCalledWith(null, 'account-link', { owners: [mockAccount2.address + '@eip155:1'], onlyGenesis: true })
      expect(mockDocument.change).toHaveBeenCalledWith(mockAccount2.proof)
    })

    it('should update a ceramic document with a generated proof if no proof provided', async () => {
      await accountLinks.update(mockAccount1.address, mockAccount1.did)

      expect(mockCeramic.createDocument).toHaveBeenCalledWith(null, 'account-link', { owners: [mockAccount1.address + '@eip155:1'], onlyGenesis: true })
      expect(mockDocument.change).toHaveBeenCalledWith(mockAccount1.proof)
    })

    it('should throw an error if no provider is defined and no proof given', async () => {
      accountLinks = new AccountLinks(mockCeramic, null)

      const resultPromise = accountLinks.update(mockAccount1.address, mockAccount1.did)

      await expect(resultPromise).rejects.toThrow(/Provider must be set/i)
    })
  })

  describe.skip('delete', async () => {
    it('should update the content of the ceramic document to an empty string', () => {

    })
  })

  
})