const idUtils = require('../utils/id')

const TYPE = '3ID'
const JWT_HEADER = idUtils.encodeSection({ typ: 'JWT', alg: 'ES256K' })

class OdbIdentityProvider {
  constructor ({ threeId }) {
    // super(options)
    this.threeId = threeId
  }

  static get type () {
    return '3ID'
  }

  async getId ({ space }) {
    if (space) {
      return this.threeId.getSubDID(space)
    } else {
      return this.threeId.DID
    }
  }

  async signIdentity (data, { space }) {
    const payload = {
      data,
      iat: null
    }
    return (await this.threeId.signJWT(payload, { space })).split('.')[2]
  }

  static async verifyIdentity (identity) {
    const payload = idUtils.encodeSection({
      iat: null,
      data: identity.publicKey + identity.signatures.id,
      iss: identity.id
    })
    const jwt = `${JWT_HEADER}.${payload}.${identity.signatures.publicKey}`
    try {
      await idUtils.verifyClaim(jwt)
    } catch (e) {
      return false
    }
    return true
   }
}

module.exports = OdbIdentityProvider
