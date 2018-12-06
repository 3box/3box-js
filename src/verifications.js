const verifier = require('./utils/verifier')

class Verifications {
  /**
   * Please use **box.verified** to get the instance of this class
   */
  constructor (box) {
    this._box = box;
    this._did = box._muportDID.getDid();
  }


  /**
   * Internal function to prevent using the methods without having been initialized with a 3Box
   */
  _requireBox() {
    if (!this._box) throw new Error("_requireBox: 3Box is not available");
  }

  /**
   * Internal method used to call the verification function with the DID and the proof.
   * If verification is successful, proof is stored in the public store.
   * Throws an error if verification is not successful.
   *
   * @param     {Sting}               key                     Account key to be stored in the public profile
   * @param     {String/Object}       proof                   This param will be sent to the verification function and stored in the 3box
   *                                                          profile for future verification
   * @param     {Function}            verificationFunction    Function receiving the user DID and the proof received as param.
   *                                                          This function should return the username to be stored in the 3box profile
   */
  async _addVerifiedPublicAccount(key, proof, verificationFunction) {
    this._requireBox();
    await verificationFunction(this._did, proof);
    await this._box.public.set("proof_" + key, proof);
    return true;
  }

  /**
   * Internal method to retrieve the verified value for a given key. It will verifiy if the proof is still valid
   * 
   * @param {sting}     key - Account key to be retireved from the public profile
   * @param {function}  verificationFunction - Function receiving the user DID and the proof received as param.
   * This function should return the username of the user that will be compared to the value stored  in the 3box profile.
   */
  async _getVerifiedPublicAccount(key, verificationFunction) {
    this._requireBox();
    const proof = await this._box.public.get("proof_" + key);
    console.log(proof);
    return await verificationFunction(this._did, proof);
  }

  /**
   * Verifies that the user has a valid github account
   * Throws an error otherwise.
   *
   * @return    {String}                                    The github handle of the user
   */
  async github () {
    return await this._getVerifiedPublicAccount("github", verifier.verifyGithub);
  }

  /**
   * Adds a github verification to the users profile
   * Throws an error if the verification fails.
   *
   * @param     {Object}            gistUrl                 URL of the proof
   * @return    {String}                                    The github handle of the user
   */
  async addGithub (gistUrl) {
    return this._addVerifiedPublicAccount("github", gistUrl, verifier.verifyGithub);
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
