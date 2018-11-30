const { httpRequest } = require('../utils')

module.exports = {
  /**
   * Verifies that the gist contains the given muportDID and returns the users github handle.
   * Throws an error otherwise.
   *
   * @param     {String}            did                     The muport DID of the user
   * @param     {Object}            gistUrl                 URL of the proof
   * @return    {String}                                    The github handle of the user
   */
  verifyGithub: (did, gistUrl) => {
    return ''
  },

  /**
   * Verifies that the tweet contains the given muportDID and returns the users twitter handle.
   * Throws an error otherwise.
   *
   * @param     {String}            did                     The muport DID of the user
   * @param     {Object}            tweetUrl                URL of the proof
   * @return    {String}                                    The twitter handle of the user
   */
  verifyTwitter: (did, tweetUrl) => {
    return ''
  }
}
