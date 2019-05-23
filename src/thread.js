class Thread {
  /**
   * Please use **space.joinThread** to get the instance of this class
   */
  constructor (orbitdb, name, threeId, membersOnly, rootMod, subscribe, ensureConnected) {
    this._orbitdb = orbitdb
    this._name = name
    this._3id = threeId
    this._subscribe = subscribe
    this._ensureConnected = ensureConnected
    this._queuedNewPosts = []
    this._membersOnly = membersOnly
    this._rootMod = rootMod || this._3id.getDid()
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
   * Add a moderator to this thread
   *
   * @param     {String}    id                      Moderator Id
   */
  async addMod (id) {
    this._requireLoad()
    return this._db.access.grant('mod', id)
  }


  /**
   * List moderators
   *
   * @return    {Array<String>}      Array of moderator DIDs
   */
  async listMods () {
    this._requireLoad()
    return this._db.access.capabilities['mod']
  }

  /**
   * Add a member to this thread
   *
   * @param     {String}    id                      Member Id
   */
  async addMember (id) {
    // TOOD throw is not a member only thread
    this._requireLoad()
    return this._db.access.grant('member', id)
  }

  /**
   * List members
   *
   * @return    {Array<String>}      Array of member DIDs
   */
  async listMembers () {
    // TODO maybe throw is not a member only thread, or * to indicate all (like orbit)
    this._requireLoad()
    return this._db.access.capabilities['member']
  }


  /**
   * Delete post
   *
   * @param     {String}    id                      Moderator Id
   */
  async deletePost (hash) {
    this._requireLoad()
    return this._db.remove(hash)
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
      if (entry.payload.op === 'ADD') {
        let post = entry.payload.value
        post.postId = entry.hash
        newPostFn(post)
      }
    })
  }

  async _load (odbAddress) {
    // TODO - threads should use the space keyring once pairwise DIDs are implemented
    const identity = await this._3id._mainKeyring.getIdentity()
    this._db = await this._orbitdb.feed(odbAddress || this._name, {
      identity,
      accessController: {
        type: 'thread-access',
        threadName: this._name,
        members: this.membersOnly,
        rootMod: this.rootMod
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
