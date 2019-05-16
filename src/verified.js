const verifier = require('./utils/verifier')

class Verified {
  /**
   * Please use **box.verified** to get the instance of this class
   */
  constructor (box) {
    this._box = box
    this._did = box._3id.muportDID
  }

  async _addVerifiedPublicAccount (key, proof, verificationFunction) {
    const account = await verificationFunction(this._did, proof)
    await this._box.public.set('proof_' + key, proof)
    return account
  }

  async _getVerifiedPublicAccount (key, verificationFunction) {
    const proof = await this._box.public.get('proof_' + key)
    return verificationFunction(this._did, proof)
  }

  async _addVerifiedPrivateAccount (key, proof, verificationFunction) {
    const account = await verificationFunction(this._did, proof)
    await this._box.private.set('proof_' + key, proof)
    return account
  }

  async _getVerifiedPrivateAccount (key, verificationFunction) {
    const proof = await this._box.private.get('proof_' + key)
    return verificationFunction(this._did, proof)
  }

  /**
   * Returns the verified DID of the user
   *
   * @return    {String}                            The DID of the user
   */
  async DID () {
    return this._did
  }

  /**
   * Verifies that the user has a valid github account
   * Throws an error otherwise.
   *
   * @return    {Object}                            Object containing username, and proof
   */
  async github () {
    return this._getVerifiedPublicAccount('github', verifier.verifyGithub)
  }

  /**
   * Adds a github verification to the users profile
   * Throws an error if the verification fails.
   *
   * @param     {Object}            gistUrl         URL of the proof
   * @return    {Object}                            Object containing username, and proof
   */
  async addGithub (gistUrl) {
    return this._addVerifiedPublicAccount('github', gistUrl, verifier.verifyGithub)
  }

  /**
   * Verifies that the user has a valid twitter account
   * Throws an error otherwise.
   *
   * @return    {Object}                            Object containing username, proof, and the verifier
   */
  async twitter () {
    return this._getVerifiedPublicAccount('twitter', verifier.verifyTwitter)
  }

  /**
   * Adds a twitter verification to the users profile
   * Throws an error if the verification fails.
   *
   * @param     {String}            claim           A did-JWT claim ownership of a twitter username
   * @return    {Object}                            Object containing username, proof, and the verifier
   */
  async addTwitter (claim) {
    return this._addVerifiedPublicAccount('twitter', claim, verifier.verifyTwitter)
  }

  /**
 * Verifies that the user has a verified email account
 * Throws an error otherwise.
 *
 * @return    {Object}                            Object containing username, proof, and the verifier
 */
  async email () {
    return this._getVerifiedPrivateAccount('email', verifier.verifyEmail)
  }

  /**
   * Adds an email verification to the users profile
   * Throws an error if the verification fails.
   *
   * @param     {String}            claim           A did-JWT claim ownership of an email username
   * @return    {Object}                            Object containing username, proof, and the verifier
   */
  async addEmail (claim) {
    return this._addVerifiedPrivateAccount('email', claim, verifier.verifyEmail)
  }
}

module.exports = Verified
