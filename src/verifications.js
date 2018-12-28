const verifier = require('./utils/verifier')

class Verifications {
  /**
   * @private
   * Please use **box.verified** to get the instance of this class
   */
  constructor (box) {
    this._box = box
    this._did = box._muportDID.getDid()
  }

  async _addVerifiedPublicAccount (key, proof, verificationFunction) {
    await verificationFunction(this._did, proof)
    await this._box.public.set('proof_' + key, proof)
    return true
  }

  async _getVerifiedPublicAccount (key, verificationFunction) {
    const proof = await this._box.public.get('proof_' + key)
    return verificationFunction(this._did, proof)
  }

  /**
   * Verifies that the user has a valid github account
   * Throws an error otherwise.
   *
   * @return    {String}                                    The github handle of the user
   */
  async github () {
    return this._getVerifiedPublicAccount('github', verifier.verifyGithub)
  }

  /**
   * Adds a github verification to the users profile
   * Throws an error if the verification fails.
   *
   * @param     {Object}            gistUrl                 URL of the proof
   * @return    {String}                                    The github handle of the user
   */
  async addGithub (gistUrl) {
    return this._addVerifiedPublicAccount('github', gistUrl, verifier.verifyGithub)
  }

  /**
   * Verifies that the user has a valid twitter account
   * Throws an error otherwise.
   *
   * @return    {String}                                    The twitter handle of the user
   */
  async twitter () {
    return this._getVerifiedPublicAccount('twitter', verifier.verifyTwitter)
  }

  /**
   * Adds a twitter verification to the users profile
   * Throws an error if the verification fails.
   *
   * @param     {String}            claim                   A did-JWT claim  ownership of a twitter handle
   * @return    {String}                                    The twitter handle of the user
   */
  async addTwitter (claim) {
    return this._addVerifiedPublicAccount('twitter', claim, verifier.verifyTwitter)
  }
}

module.exports = Verifications
