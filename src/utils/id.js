const didJWT = require('did-jwt')
const DID_MUPORT_PREFIX = 'did:muport:'

module.exports = {
  isMuportDID: (address) => address.startsWith(DID_MUPORT_PREFIX),
  isClaim: async (claim, opts = {}) => {
    try {
      await didJWT.decodeJWT(claim, opts)
      return true
    } catch (e) {
      return false
    }
  },
  verifyClaim: async (claim, opts = {}) => {
    try {
      return await didJWT.verifyJWT(claim, opts)
    } catch (e) {
      return null
    }
  }
}