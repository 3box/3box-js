const verifier = require('./utils/verifier')

class Verifications {
  /**
   * Please use **box.verified** to get the instance of this class
   */
  constructor (box) {
    this._box = box
  }

  /**
   * Verifies that the user has a valid github account
   * Throws an error otherwise.
   *
   * @return    {String}                                    The github handle of the user
   */
  async github () {
    return ''
  }

  /**
   * Adds a github verification to the users profile
   * Throws an error if the verification fails.
   *
   * @param     {Object}            gistUrl                 URL of the proof
   * @return    {String}                                    The github handle of the user
   */
  async addGithub (gistUrl) {
    return false
  }

  /**
   * Verifies that the user has a valid twitter account
   * Throws an error otherwise.
   *
   * @return    {String}                                    The twitter handle of the user
   */
  async twitter () {
    return ''
  }

  /**
   * Adds a twitter verification to the users profile
   * Throws an error if the verification fails.
   *
   * @param     {Object}            tweetUrl                URL of the proof
   * @return    {String}                                    The twitter handle of the user
   */
  async addTwitter (tweetUrl) {
    return false
  }
}

module.exports = Verifications
