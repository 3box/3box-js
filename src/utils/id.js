/**
 * A module to verify & validate claims
 *
 * @name idUtils
 * @memberof Box
 */
const didJWT = require('did-jwt')
const DID_MUPORT_PREFIX = 'did:muport:'

module.exports = {
  /**
   * Check whether a string is a muport did or not
   *
   * @memberOf Box.idUtils
   * @param   {String}     address  A string containing a user profile address
   * @return  {*|boolean}           Whether the address is a muport did or not
   */
  isMuportDID: (address) => address.startsWith(DID_MUPORT_PREFIX),

  /**
   * Check whether a string is a valid claim or not
   *
   * @memberOf Box.idUtils
   * @param  {String}             claim
   * @param  {Object}             opts            Optional parameters
   * @param  {string}             opts.audience   The DID of the audience of the JWT
   * @return {Promise<boolean>}                   whether the parameter is an actual claim
   */
  isClaim: async (claim, opts = {}) => {
    try {
      await didJWT.decodeJWT(claim, opts)
      return true
    } catch (e) {
      return false
    }
  },

  /**
   * Verify a claim and return its content.
   * See https://github.com/uport-project/did-jwt/ for more details.
   *
   * @memberOf Box.idUtils
   * @param  {String}             claim
   * @param  {Object}             opts            Optional parameters
   * @param  {string}             opts.audience   The DID of the JWT's audience
   * @return {Object}                             The validated claim
   */
  verifyClaim: didJWT.verifyJWT,
}
