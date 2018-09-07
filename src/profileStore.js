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
    this.ipfs = ipfs;
    this.updateRoot = updateRoot;
    this.profile = null;
  }

  /**
   * Get the value of the given key
   *
   * @param     {String}    key                     the key
   * @return    {String}                            the value associated with the key
   */
  async get(key) {
    if (!this.profile) throw new Error("This user has no public profile yet");
    return this.profile[key];
  }

  /**
   * Set a value for the given key
   *
   * @param     {String}    key                     the key
   * @param     {String}    value                   the value
   * @return    {Boolean}                           true if successful
   */
  async set(key, value) {
    console.log("profileStore.set:" + key + "->" + value);
    console.log(this.profile);
    if (!this.profile) {
      this.profile = {};
    }
    this.profile[key] = value;

    return this._uploadProfile();
  }

  /**
   * Remove the value for the given key
   *
   * @param     {String}    key                     the key
   * @return    {Boolean}                           true if successful
   */
  async remove(key) {
    delete this.profile[key];

    return this._uploadProfile();
  }

  /**
   * Upload the instanced profile to IPFS
   *
   * @return    {Boolean}                           true if successful
   */
  async _uploadProfile() {
    //TODO: change to ipfs-mini.addJSON

    const profile = JSON.stringify(this.profile);
    console.log("_uploadProfile:" + profile);

    let ipfsRes;
    let multihash;

    try {
      ipfsRes = await this.ipfs.add(new Buffer(profile));
      multihash = ipfsRes[0].hash;
    } catch (e) {
      console.error("Error when uploading profile to ipfs", e);
      return false;
    }

    try {
      await this.updateRoot(multihash);
      return true;
    } catch (e) {
      console.error("Error when updating root", e);
      return false;
    }
  }

  /**
   * Sync the profile store with the given ipfs hash
   *
   * @param     {String}    hash                        The hash of the profile object
   */
  async _sync(hash) {
    if (hash !== undefined) {
      //download profile from ipfs
      const ipfsRes = await this.ipfs.cat(hash);
      const profile = JSON.parse(ipfsRes.toString("utf8"));
      console.log(profile);
      this.profile = profile;
    } else {
      this.profile = {};
    }
  }
}

module.exports = ProfileStore;
