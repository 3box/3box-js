
class ProfileStore {
  /**
   * Instantiates a ProfileStore
   *
   * @param     {IPFS}      ipfs                        An instance of the ipfs api
   * @param     {function}  updateRoot                  A callback function that is called when the store has been updated
   * @param     {function}  linkProfile                 A callback function that is called if the profile is not made public yet
   * @return    {ProfileStore}                          self
   */
  constructor(ipfs, updateRoot, linkProfile) {
    this.ipfs = ipfs
    this.updateRoot = updateRoot
    this.profile = null;
  }

  /**
   * Get the value of the given key
   *
   * @param     {String}    key                     the key
   * @return    {String}                            the value associated with the key
   */
  async get (key) {
    return this.profile[key]
  }

  /**
   * Set a value for the given key
   *
   * @param     {String}    key                     the key
   * @param     {String}    value                   the value
   * @return    {Boolean}                           true if successful
   */
  async set (key, value) {
    console.log("profileStore.set:"+key+"->"+value);
    console.log(this.profile);
    if (!this.profile) {
      this.profile = {}
    }
    this.profile[key] = value

    return this._uploadProfile()
  }

  /**
   * Remove the value for the given key
   *
   * @param     {String}    key                     the key
   * @return    {Boolean}                           true if successful
   */
  async remove (key) {
    delete this.profile[key]

    return this._uploadProfile()
  }

  async _uploadProfile () {
    //TODO: change to ipfs-mini.addJSON

    const profile = JSON.stringify(this.profile)
    console.log("_uploadProfile:"+profile)
    const ipfsRes=await this.ipfs.add(new Buffer(profile));
    const multihash = ipfsRes[0].hash;
    await this.updateRoot(multihash)

    // TODO - error handling
    return true
  }

  /**
   * Sync the profile store with the given ipfs hash
   *
   * @param     {String}    hash                        The hash of the profile object
   */
  async _sync (hash) {
    if(hash != undefined){
      //download profile from ipfs
      const ipfsRes=await this.ipfs.cat(hash);
      const profile = JSON.parse(ipfsRes.toString('utf8'));
      console.log(profile);
      
      this.profile = profile;
    }else{
      this.profile = {};
    }
  }
}

module.exports = ProfileStore
