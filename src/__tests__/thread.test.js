const utils = require('./testUtils')
const Thread = require('../thread')
const OrbitDB = require('orbit-db')
const EC = require('elliptic').ec
const ec = new EC('secp256k1')

const THREAD1_NAME = '3box.thread.somespace.name1'
const THREAD2_NAME = '3box.thread.somespace.name2'

const MSG1 = 'message1'
const MSG2 = 'message2'
const MSG3 = 'message3'
const MSG4 = 'message4'

const THREEID1_MOCK = {
  _mainKeyring: {
    getDBKey: () => ec.keyFromPrivate('f917ac6883f88798a8ce39821fa523f2acd17c0ba80c724f219367e76d8f2c46')
  },
  getDid: () => 'did:3:mydid1'
}
const THREEID2_MOCK = {
  _mainKeyring: {
    getDBKey: () => ec.keyFromPrivate('f977777aaaaaaabbbbbbb9821fa523f2acd17c0ba80c724f219367e76d8f2c46')
  },
  getDid: () => 'did:3:mydid2'
}

const ensureConnected = jest.fn()
const subscribeMock = jest.fn()

describe('Thread', () => {
  let ipfs
  let orbitdb
  let thread
  let storeAddr
  jest.setTimeout(20000)

  beforeAll(async () => {
    ipfs = await utils.initIPFS(4)
    orbitdb = new OrbitDB(ipfs, './tmp/orbitdb4')
  })

  beforeEach(() => {
    ensureConnected.mockClear()
    subscribeMock.mockClear()
  })

  it('creates thread correctly', async () => {
    thread = new Thread(orbitdb, THREAD1_NAME, THREEID1_MOCK, subscribeMock, ensureConnected)
  })

  it('should throw if not loaded', async () => {
    expect(thread.post('key')).rejects.toThrow(/_load must/)
    expect(thread.getPosts()).rejects.toThrow(/_load must/)
    expect(thread.onNewPost(() => {})).rejects.toThrow(/_load must/)
  })

  it('should start with an empty db on load', async () => {
    storeAddr = await thread._load()
    expect(storeAddr.split('/')[3]).toEqual(THREAD1_NAME)
    expect(await thread.getPosts()).toEqual([])
    expect(ensureConnected).toHaveBeenCalledTimes(1)
    expect(ensureConnected).toHaveBeenCalledWith(storeAddr, true)
  })

  it('adding posts works as expected', async () => {
    await thread.post(MSG1)
    let posts = await thread.getPosts()
    expect(posts[0].author).toEqual(THREEID1_MOCK.getDid())
    expect(posts[0].message).toEqual(MSG1)
    expect(subscribeMock).toHaveBeenCalledTimes(1)
    expect(ensureConnected).toHaveBeenCalledTimes(1)
    expect(ensureConnected).toHaveBeenNthCalledWith(1, storeAddr, true)

    await thread.post(MSG2)
    posts = await thread.getPosts()
    expect(posts[0].message).toEqual(MSG1)
    expect(posts[1].message).toEqual(MSG2)
    expect(subscribeMock).toHaveBeenCalledTimes(2)
    expect(ensureConnected).toHaveBeenCalledTimes(2)
    expect(ensureConnected).toHaveBeenNthCalledWith(2, storeAddr, true)

    await thread.post(MSG3)
    posts = await thread.getPosts()
    expect(posts[0].message).toEqual(MSG1)
    expect(posts[1].message).toEqual(MSG2)
    expect(posts[2].message).toEqual(MSG3)
    expect(subscribeMock).toHaveBeenCalledTimes(3)
    expect(ensureConnected).toHaveBeenCalledTimes(3)
    expect(ensureConnected).toHaveBeenNthCalledWith(3, storeAddr, true)
  })

  describe('multi user interaction', () => {
    let threadUser1
    let threadUser2
    let ipfs2
    let orbitdb2
    beforeAll(async () => {
      ipfs2 = await utils.initIPFS(5)
      orbitdb2 = new OrbitDB(ipfs2, './tmp/orbitdb5')
    })

    it('syncs thread between users', async () => {
      threadUser1 = new Thread(orbitdb, THREAD2_NAME, THREEID1_MOCK, subscribeMock, ensureConnected)
      await threadUser1._load()
      threadUser2 = new Thread(orbitdb2, THREAD2_NAME, THREEID2_MOCK, subscribeMock, ensureConnected)
      await threadUser2._load()
      // user1 posts and user2 receives
      // done needed to not catch the write event
      let done = false
      let postPromise = new Promise((resolve, reject) => {
        threadUser2.onNewPost(post => {
          if (!done) {
            expect(post.message).toEqual(MSG1)
            done = true
          }
          resolve()
        })
      })
      await threadUser1.post(MSG1)
      let posts1 = await threadUser1.getPosts()
      expect(posts1[0].author).toEqual(THREEID1_MOCK.getDid())
      expect(posts1[0].message).toEqual(MSG1)
      await postPromise
      threadUser2.onNewPost(() => {})
      await new Promise((resolve, reject) => { setTimeout(resolve, 500) })
      let posts2 = await threadUser2.getPosts()
      expect(posts2[0].author).toEqual(THREEID1_MOCK.getDid())
      expect(posts2[0].message).toEqual(MSG1)
      expect(posts2[0].postId).toEqual(posts1[0].postId)

      // user2 posts and user1 receives
      postPromise = new Promise((resolve, reject) => {
        threadUser1.onNewPost(post => {
          expect(post.message).toEqual(MSG2)
          resolve()
        })
      })
      await threadUser2.post(MSG2)
      posts2 = await threadUser2.getPosts()
      expect(posts2[1].author).toEqual(THREEID2_MOCK.getDid())
      expect(posts2[1].message).toEqual(MSG2)
      await postPromise
      await new Promise((resolve, reject) => { setTimeout(resolve, 500) })
      posts1 = await threadUser1.getPosts()
      expect(posts1[1].author).toEqual(THREEID2_MOCK.getDid())
      expect(posts1[1].message).toEqual(MSG2)
      expect(posts1[1].postId).toEqual(posts2[1].postId)
    })
  })
})
