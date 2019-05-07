class Thread {
  /**
   * Please use **space.joinThread** to get the instance of this class
   */
  constructor (orbitdb, name, threeId, subscribe, ensureConnected) {
    this._orbitdb = orbitdb
    this._name = name
    this._3id = threeId
    this._subscribe = subscribe
    this._ensureConnected = ensureConnected
    this._queuedNewPosts = []
  }

  /**
   * Post a message to the thread
   *
   * @param     {Object}    message                 The message
   * @return    {String}                            The postId of the new post
   */
  async post (message) {
    this._requireLoad()
    this._subscribe()
    this._ensureConnected(this._address, true)
    return this._db.add({
      author: this._3id.muportDID,
      message,
      timeStamp: new Date().getTime()
    })
  }

  /**
   * Returns an array of posts, based on the options.
   * If hash not found when passing gt, gte, lt, or lte,
   * the iterator will return all items (respecting limit and reverse).
   *
   * @param     {Object}    opts                    Optional parameters
   * @param     {String}    opts.gt                 Greater than, takes an postId
   * @param     {String}    opts.gte                Greater than or equal to, takes an postId
   * @param     {String}    opts.lt                 Less than, takes an postId
   * @param     {String}    opts.lte                Less than or equal to, takes an postId
   * @param     {Integer}   opts.limit              Limiting the number of entries in result, defaults to -1 (no limit)
   * @param     {Boolean}   opts.reverse            If set to true will result in reversing the result
   *
   * @return    {Array<Object>}                           true if successful
   */
  async getPosts (opts = {}) {
    this._requireLoad()
    if (!opts.limit) opts.limit = -1
    return this._db.iterator(opts).collect().map(entry => {
      let post = entry.payload.value
      post.postId = entry.hash
      return post
    })
  }

  /**
   * Register a function to be called for every new
   * post that is received from the network.
   * The function takes one parameter, which is the post.
   * Note that posts here might be out of order.
   *
   * @param     {Function}  newPostFn               The function that will get called
   */
  async onNewPost (newPostFn) {
    this._requireLoad()
    this._db.events.on('replicate.progress', (address, hash, entry, prog, tot) => {
      let post = entry.payload.value
      post.postId = hash
      if (prog === tot) {
        newPostFn(post)
        this._queuedNewPosts.map(newPostFn)
        this._queuedNewPosts = []
      } else {
        this._queuedNewPosts.unshift(post)
      }
    })
    this._db.events.on('write', (dbname, entry) => {
      let post = entry.payload.value
      post.postId = entry.hash
      newPostFn(post)
    })
  }

  async _load (odbAddress) {
    // TODO - threads should use the space keyring once pairwise DIDs are implemented
    const identity = await this._3id._mainKeyring.getIdentity()
    this._db = await this._orbitdb.log(odbAddress || this._name, {
      identity,
      accessController: {
        write: ['*'],
        legacy: true
      }
    })
    await this._db.load()
    this._address = this._db.address.toString()
    this._ensureConnected(this._address, true)
    return this._address
  }

  _requireLoad () {
    if (!this._db) throw new Error('_load must be called before interacting with the store')
  }

  async close () {
    this._requireLoad()
    await this._db.close()
  }
}

module.exports = Thread
