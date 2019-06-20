const Verified = require('../verified')
const Box = require('../3box')
const didJWT = require('did-jwt')
const { registerMethod } = require('did-resolver')

const GITHUB_LINK1_URL = 'https://gist.githubusercontent.com/user1/12345'
const GITHUB_LINK1_USER = 'user1'
const GITHUB_LINK2_URL = 'https://gist.githubusercontent.com/user1/wrongLink'

jest.mock('../3box')
jest.mock('../utils', () => {
  const GITHUB_LINK1_URL = 'https://gist.githubusercontent.com/user1/12345'
  const GITHUB_LINK1_CONTENT = 'some random text did:muport:0x12345 more random text'
  const GITHUB_LINK2_URL = 'https://gist.githubusercontent.com/user1/wrongLink'
  const GITHUB_LINK2_CONTENT = 'wrong did'
  return {
    fetchText: jest.fn(async url => {
      if (url === GITHUB_LINK1_URL) {
        return GITHUB_LINK1_CONTENT
      } else if (url === GITHUB_LINK2_URL) {
        return GITHUB_LINK2_CONTENT
      } else {
        throw new Error('ERROR')
      }
    })
  }
})

registerMethod('https', async () => {
  return {
    '@context': 'https://w3id.org/did/v1',
    'id': 'did:https:test.com',
    'publicKey': [{
      'id': 'did:https:test.com#owner',
      'type': 'Secp256k1VerificationKey2018',
      'owner': 'did:https:test.com',
      'publicKeyHex': '044f5c08e2150b618264c4794d99a22238bf60f1133a7f563e74fcf55ddb16748159872687a613545c65567d2b7a4d4e3ac03763e1d9a5fcfe512a371faa48a781'
    }],
    'authentication': [{
      'type': 'Secp256k1SignatureAuthentication2018',
      'publicKey': 'did:https:test.com#owner'
    }]
  }
})
const httpsDidSigner = didJWT.SimpleSigner('95838ece1ac686bde68823b21ce9f564bc536eebb9c3500fa6da81f17086a6be')

describe('Verified', () => {
  let box
  let verified

  beforeAll(async () => {
    box = await Box.openBox('0x12345', 'web3prov')
    verified = new Verified(box)
  })

  describe('github', () => {
    it('should add the github proof and get the github handler to verify if it is verified', async () => {
      await verified.addGithub(GITHUB_LINK1_URL)
      let github = await verified.github()
      expect(github).toEqual({
        username: GITHUB_LINK1_USER,
        proof: GITHUB_LINK1_URL
      })
    })

    it('should throw if gistUrl does not contain the correct did', async () => {
      expect(verified.addGithub(GITHUB_LINK2_URL)).rejects.toEqual(new Error('Gist File provided does not contain the correct DID of the user'))
    })

    it('should throw if gistUrl is empty', async () => {
      expect(await verified.addGithub('')).toEqual(null)
    })
  })

  describe('twitter', () => {
    let incorrectClaim
    let correctClaim

    beforeAll(async () => {
      incorrectClaim = await didJWT.createJWT({
        sub: 'did:muport:QMasdivuhs',
        iat: 123456789,
        claim: {
          werid_claim: 'some data'
        }
      }, {
        issuer: 'did:https:test.com',
        signer: httpsDidSigner
      })
      correctClaim = await didJWT.createJWT({
        sub: 'did:muport:0x12345',
        iat: 123456789,
        claim: {
          twitter_handle: 'twitterUser',
          twitter_proof: 'https://twitter.com/twitterUser/12387623'
        }
      }, {
        issuer: 'did:https:test.com',
        signer: httpsDidSigner
      })
    })

    // TODO - Not sure how to mock the https-did-resolver. The code on top stopped working.
    it.skip('should add the twitter proof and get the twitter handler to verify if it is verified', async () => {
      await verified.addTwitter(correctClaim)
      let twitter = await verified.twitter()
      expect(twitter).toEqual({ 'username': 'twitterUser', 'proof': 'https://twitter.com/twitterUser/12387623', 'verifiedBy': 'did:https:test.com' })
    })

    it('should throw if twitter claim does not contain the correct did', async () => {
      expect(verified.addTwitter(incorrectClaim)).rejects.toEqual(new Error('Verification not valid for given user'))
    })

    it('should throw if twitter claim does not contain username and proof', async () => {
      incorrectClaim = await didJWT.createJWT({
        sub: 'did:muport:0x12345',
        iat: 123456789,
        claim: {
          werid_claim: 'some data'
        }
      }, {
        issuer: 'did:https:test.com',
        signer: httpsDidSigner
      })
      expect(verified.addTwitter(incorrectClaim)).rejects.toEqual(new Error('The claim for your twitter is not correct'))
    })
  })

  describe('email', () => {
    let incorrectClaim
    let correctClaim

    beforeAll(async () => {
      incorrectClaim = await didJWT.createJWT({
        sub: 'did:muport:QMasdivuhs',
        iat: 123456789,
        claim: {
          werid_claim: 'some data'
        }
      }, {
        issuer: 'did:https:test.com',
        signer: httpsDidSigner
      })
      correctClaim = await didJWT.createJWT({
        sub: 'did:muport:0x12345',
        iat: 123456789,
        claim: {
          email_address: 'user@3box.io',
          code: '123456'
        }
      }, {
        issuer: 'did:https:test.com',
        signer: httpsDidSigner
      })
    })

    it('should add the email proof and get the email address to verify if it is verified', async () => {
      await verified.addEmail(correctClaim)
      let email = await verified.email()
      expect(email).toEqual({ 'email_address': 'user@3box.io', 'verifiedBy': 'did:https:test.com' })
    })

    it('should throw if email claim does not contain the correct did', async () => {
      expect(verified.addEmail(incorrectClaim)).rejects.toEqual(new Error('Verification not valid for given user'))
    })

    it('should throw if twitter claim does not contain email_address and proof', async () => {
      incorrectClaim = await didJWT.createJWT({
        sub: 'did:muport:0x12345',
        iat: 123456789,
        claim: {
          werid_claim: 'some data'
        }
      }, {
        issuer: 'did:https:test.com',
        signer: httpsDidSigner
      })
      expect(verified.addEmail(incorrectClaim)).rejects.toEqual(new Error('The claim for your email address is not correct'))
    })
  })
})
