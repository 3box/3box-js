const didJWT = require('did-jwt')
const Identities = require('orbit-db-identity-provider')
const { OdbIdentityProvider } = require('3box-orbitdb-plugins')
Identities.addIdentityProvider(OdbIdentityProvider)

const pubKey = '044f5c08e2150b618264c4794d99a22238bf60f1133a7f563e74fcf55ddb16748159872687a613545c65567d2b7a4d4e3ac03763e1d9a5fcfe512a371faa48a781'
const privKey = '95838ece1ac686bde68823b21ce9f564bc536eebb9c3500fa6da81f17086a6be'

const didResolverMock = async (did) => {
  return {
    '@context': 'https://w3id.org/did/v1',
    'id': did,
    'publicKey': [{
      'id': `${did}#signingKey`,
      'type': 'Secp256k1VerificationKey2018',
      'publicKeyHex': pubKey
    }],
    'authentication': [{
      'type': 'Secp256k1SignatureAuthentication2018',
      'publicKey': `${did}#signingKey`
    }]
  }
}

const threeIDMockFactory = (did) => {
  const signJWT = payload => {
    return didJWT.createJWT(payload, {
      signer: didJWT.SimpleSigner(privKey),
      issuer: did
    })
  }

  const getPublicKeys = () => {
    return { signingKey: pubKey }
  }

  const getSubDID = () => did

  const getOdbId = () => {
    return Identities.createIdentity({
      type: '3ID',
      threeId: {signJWT, DID: did, getSubDID},
      identityKeysPath: `./tmp/${did}`
    })
  }

  return {
    DID: did,
    signJWT,
    getPublicKeys,
    getOdbId,
    getSubDID
  }
}

module.exports = { threeIDMockFactory, didResolverMock }
