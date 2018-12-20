const { fetchText } = require('./index')
const didJWT = require('did-jwt')
require('https-did-resolver')()

module.exports = {
  /**
   * Verifies that the gist contains the given muportDID and returns the users github handle.
   * Throws an error otherwise.
   *
   * @param     {String}            did                     The muport DID of the user
   * @param     {Object}            gistUrl                 URL of the proof
   * @return    {String}                                    The github handle of the user
   */
  verifyGithub: async (did, gistUrl) => {
    if (!gistUrl || gistUrl.trim() === '') {
      throw new Error('The proof of your Github is not available')
    }

    let gistFileContent = await fetchText(gistUrl)

    if (gistFileContent.indexOf(did) === -1) {
      throw new Error('Gist File provided does not contain the correct DID of the user')
    }

    const githubUsername = gistUrl.split('/')[3]
    return githubUsername
  },
  /**
   * Verifies that the tweet contains the given muportDID and returns the users twitter handle.
   * Throws an error otherwise.
   *
   * @param     {String}            did             The muport DID of the user
   * @param     {String}            claim           A did-JWT with claim
   * @return    {Object}                            Object containing twitter handle of the user and the verifier
   */
  verifyTwitter: (did, claim) => {
    const verified = didJWT.verifyJWT(claim)
    if (verified.payload.sub !== did) {
      throw new Error('Verification not valid for given user')
    }
    return {
      twitter: verified.payload.claim.twitter_handle,
      verifier: verified.payload.iss
    }
  }
}
