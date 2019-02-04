import { fetchText } from './index'
import didJWT from 'did-jwt'
import registerHttpsResolver from 'https-did-resolver'
registerHttpsResolver()
import registerMuortResolver from 'muport-did-resolver'
registerMuortResolver()

/**
 * Verifies that the gist contains the given muportDID and returns the users github username.
 * Throws an error otherwise.
 *
 * @param     {String}            did                     The muport DID of the user
 * @param     {Object}            gistUrl                 URL of the proof
 * @return    {Object}                                    Object containing username, and proof
 */
export async function verifyGithub (did, gistUrl){
  if (!gistUrl || gistUrl.trim() === '') {
    return null
  }

  let gistFileContent = await fetchText(gistUrl)

  if (gistFileContent.indexOf(did) === -1) {
    throw new Error('Gist File provided does not contain the correct DID of the user')
  }

  const username = gistUrl.split('/')[3]
  return {
    username,
    proof: gistUrl
  }
}

/**
 * Verifies that the tweet contains the given muportDID and returns the users twitter username.
 * Throws an error otherwise.
 *
 * @param     {String}            did             The muport DID of the user
 * @param     {String}            claim           A did-JWT with claim
 * @return    {Object}                            Object containing username, proof, and the verifier
 */
export async function verifyTwitter (did, claim) {
  if (!claim) return null
  const verified = await didJWT.verifyJWT(claim)
  if (verified.payload.sub !== did) {
    throw new Error('Verification not valid for given user')
  }
  const claimData = verified.payload.claim
  if (!claimData.twitter_handle || !claimData.twitter_proof) {
    throw new Error('The claim for your twitter is not correct')
  }
  return {
    username: claimData.twitter_handle,
    proof: claimData.twitter_proof,
    verifiedBy: verified.payload.iss
  }
}

/**
 * Verifies that the proof for a did is correct
 *
 * @param     {String}            claim           A did-JWT with claim
 * @return    {String}                            The DID of the user
 */
export async function verifyDID (claim) {
  const verified = await didJWT.verifyJWT(claim)
  return verified.payload.iss
}

export default {verifyGithub, verifyTwitter, verifyDID}
