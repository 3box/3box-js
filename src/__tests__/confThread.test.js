jest.mock('3id-resolver', () => {
  const { didResolverMock } = require('../__mocks__/3ID')
  return {
    getResolver: () => ({'3': didResolverMock})
  }
})

const utils = require('./testUtils')
const ThreadImport = require('../thread')
const OrbitDB = require('orbit-db')
const {
  OdbIdentityProvider,
  LegacyIPFS3BoxAccessController,
  ThreadAccessController,
  ModeratorAccessController
} = require('3box-orbitdb-plugins')
const { Resolver } = require('did-resolver')
const Identities = require('orbit-db-identity-provider')
Identities.addIdentityProvider(OdbIdentityProvider)
const AccessControllers = require('orbit-db-access-controllers')
AccessControllers.addAccessController({ AccessController: LegacyIPFS3BoxAccessController })
AccessControllers.addAccessController({ AccessController: ThreadAccessController })
AccessControllers.addAccessController({ AccessController: ModeratorAccessController })
const { threeIDMockFactory, mockDidResolver } = require('../__mocks__/3ID')
const naclUtil = require('tweetnacl-util')

const nacl = {}
nacl.util = require('tweetnacl-util')

const DID1 = 'did:3:zdpuAsaK9YsqpphSBeQvfrKAjs8kF7vUX4Y3kMkMRgEQigzCt'
const DID2 = 'did:3:zdpuB2DcKQKNBDz3difEYxjTupsho5VuPCLgRbRunXqhmrJaX'
const DID3 = 'did:3:zdpuAvKY6Noex9nRMp1pR8dHauT5Rn4yhVuLq9bAdz4pp5oRd'

const THREAD1_NAME = '3box.thread.somespace.name1'
const THREAD2_NAME = '3box.thread.somespace.name2'
const THREAD3_NAME = '3box.thread.somespace.name2'

const randomThreadName = () => `3box.thread.somespace.name${Math.floor(Math.random() * 1000)}`

const MSG1 = 'message1'
const MSG2 = 'message2'
const MSG3 = 'message3'
const MSG4 = 'message4'

const MSGObj = { "greetings": "hello" }

const THREEID1_MOCK = threeIDMockFactory(DID1)
const THREEID2_MOCK = threeIDMockFactory(DID2)
const THREEID3_MOCK = threeIDMockFactory(DID3)

const subscribeMock = jest.fn()

const userMock = (did) => {
  return {
      encrypt: (msg) => {
        const obj = {
          nonce: '123',
          ciphertext: Buffer.from(msg).toString('base64')
        }
        return Promise.resolve(obj)
      },
      decrypt: (obj) =>  {
        return Promise.resolve( Buffer.from(obj.ciphertext, 'base64'))
      },
      DID: did
    }
}

const Thread = (threadName, replicator, members, firstMod, conf, user, sub) => {
  return new ThreadImport(threadName, replicator, members, firstMod, conf || true, userMock(user), sub)
}

describe('Confidential Thread', () => {
  let ipfs
  let orbitdb
  let thread
  let storeAddr
  let replicatorMock
  jest.setTimeout(20000)

  beforeAll(async () => {
    ipfs = await utils.initIPFS(24)
    OdbIdentityProvider.setDidResolver(mockDidResolver)
    const identity = await Identities.createIdentity({ id: 'nullid', identityKeysPath: './tmp/odbIdentityKeys-thread' })
    orbitdb = await OrbitDB.createInstance(ipfs, {
      directory:'./tmp/orbitdb4',
      identity
    })
    replicatorMock = {
      _orbitdb: orbitdb,
      ensureConnected: jest.fn()
    }
  })

  beforeEach(() => {
    subscribeMock.mockClear()
    replicatorMock.ensureConnected.mockClear()
  })

  it('creates thread correctly', async () => {
    thread = new Thread(THREAD1_NAME, replicatorMock, false, DID1, undefined, DID1, subscribeMock)
  })

  it('should throw if not loaded', async () => {
    await expect(thread.post('key')).rejects.toThrow(/_load must/)
    await expect(thread.getPosts()).rejects.toThrow(/_load must/)
    await expect(thread.onUpdate(() => {})).rejects.toThrow(/_load must/)
  })

  it('should throw if not authed', async () => {
    storeAddr = await thread._load()
    await expect(thread.post('key')).rejects.toThrow(/You must/)
    await expect(thread.addModerator('key')).rejects.toThrow(/You must/)
    await expect(thread.addMember('key')).rejects.toThrow(/You must/)
    await expect(thread.deletePost('key')).rejects.toThrow(/You must/)
    // load should call this:
    expect(replicatorMock.ensureConnected).toHaveBeenCalledTimes(1)
    expect(replicatorMock.ensureConnected).toHaveBeenCalledWith(storeAddr, true)
  })

  it('should start with an empty db on load', async () => {
    await thread._setIdentity(await THREEID1_MOCK.getOdbId())
    expect(storeAddr.split('/')[3]).toEqual(THREAD1_NAME)
    expect(await thread.getPosts()).toEqual([])
  })

  it('adding posts works as expected', async () => {

    await thread.post(MSG1)
    let posts = await thread.getPosts()
    expect(posts[0].author).toEqual(THREEID1_MOCK.DID)
    expect(posts[0].message).toEqual(MSG1)
    expect(subscribeMock).toHaveBeenCalledTimes(1)
    expect(replicatorMock.ensureConnected).toHaveBeenCalledTimes(1)
    expect(replicatorMock.ensureConnected).toHaveBeenNthCalledWith(1, storeAddr, true)

    await thread.post(MSG2)
    posts = await thread.getPosts()
    expect(posts[0].message).toEqual(MSG1)
    expect(posts[1].message).toEqual(MSG2)
    expect(subscribeMock).toHaveBeenCalledTimes(2)
    expect(replicatorMock.ensureConnected).toHaveBeenCalledTimes(2)
    expect(replicatorMock.ensureConnected).toHaveBeenNthCalledWith(2, storeAddr, true)

    await thread.post(MSG3)
    posts = await thread.getPosts()
    expect(posts[0].message).toEqual(MSG1)
    expect(posts[1].message).toEqual(MSG2)
    expect(posts[2].message).toEqual(MSG3)
    expect(subscribeMock).toHaveBeenCalledTimes(3)
    expect(replicatorMock.ensureConnected).toHaveBeenCalledTimes(3)
    expect(replicatorMock.ensureConnected).toHaveBeenNthCalledWith(3, storeAddr, true)
  })

  it('adding object posts works as expected', async () => {
    const threadName = randomThreadName()
    const thread = new Thread(threadName, replicatorMock, true, DID1, undefined, DID1, subscribeMock)
    await thread._load()
    await thread._setIdentity(await THREEID1_MOCK.getOdbId())

    await thread.post(MSGObj)
    let posts = await thread.getPosts()
    expect(posts[0].author).toEqual(THREEID1_MOCK.DID)
    expect(posts[0].message).toEqual(MSGObj)
  })

  it('root moderator can add another moderator', async () => {
    const threadName = randomThreadName()
    const threadMod1 = new Thread(threadName, replicatorMock, false, DID1, undefined, DID1, subscribeMock)
    await threadMod1._load()
    await threadMod1._setIdentity(await THREEID1_MOCK.getOdbId())

    expect(await threadMod1.listModerators()).toEqual([DID1])
    await threadMod1.addModerator(DID2)
    expect(await threadMod1.listModerators()).toEqual([DID1, DID2])
  })

  it('a moderator can add another moderator', async () => {
    const threadName = randomThreadName()
    const threadMod1 = new Thread(threadName, replicatorMock, false, DID1, undefined, DID1, subscribeMock)
    await threadMod1._load()
    await threadMod1._setIdentity(await THREEID1_MOCK.getOdbId())
    expect(await threadMod1.listModerators()).toEqual([DID1])
    await threadMod1.addModerator(DID2)
    expect(await threadMod1.listModerators()).toEqual([DID1, DID2])
    const threadMod2 = new Thread(threadName, replicatorMock, false, DID1, threadMod1._encKeyId, DID2, subscribeMock)
    await threadMod2._load()
    await threadMod2._setIdentity(await THREEID2_MOCK.getOdbId())
    await threadMod2.addModerator(DID3)
    expect(await threadMod2.listModerators()).toEqual([DID1, DID2, DID3])
  })

  it('moderator can add a Member', async () => {
    const threadName = randomThreadName()
    const threadMembers = new Thread(threadName, replicatorMock, true, DID1, undefined, DID1, subscribeMock)
    await threadMembers._load()
    await threadMembers._setIdentity(await THREEID1_MOCK.getOdbId())

    expect(await threadMembers.listMembers()).toEqual([])
    await threadMembers.addMember(DID2)
    expect(await threadMembers.listMembers()).toEqual([DID2])
  })

  it('user who is not a moderator can NOT add a Member', async () => {
    const threadName = randomThreadName()
    // Mod creates thread
    const threadMod1 = new Thread(threadName, replicatorMock, true, DID1, undefined, DID1, subscribeMock)
    await threadMod1._load()
    await threadMod1._setIdentity(await THREEID1_MOCK.getOdbId())
    await threadMod1.addMember(DID2)
    // member opens and tries to add member
    const threadMembers = new Thread(threadName, replicatorMock, true, DID1, threadMod1._encKeyId, DID2, subscribeMock)
    await threadMembers._load()
    await threadMembers._setIdentity(await THREEID2_MOCK.getOdbId())

    await expect(threadMembers.addMember(DID3)).rejects.toThrow(/can not be granted/)
    expect(await threadMembers.listMembers()).toEqual([DID2])
  })

  it('a moderator can delete other users posts', async () => {
    const threadName = randomThreadName()
    // create thread by mod, with members
    const threadMod = new Thread(threadName, replicatorMock, false, DID1, undefined, DID1, subscribeMock)
    await threadMod._load()
    await threadMod._setIdentity(await THREEID1_MOCK.getOdbId())
    await threadMod.addMember(DID2)
    await threadMod.addModerator(DID3)

    // user 1, member adds post
    const threadUser1 = new Thread(threadName, replicatorMock, false, DID1, threadMod._encKeyId, DID2, subscribeMock)
    await threadUser1._load()
    await threadUser1._setIdentity(await THREEID2_MOCK.getOdbId())
    await threadUser1.post(MSG1)
    const posts = await threadUser1.getPosts()
    const entryId = posts[0].postId

    // user 2, a mod, deletes post by user 1
    const threadMod2 = new Thread(threadName, replicatorMock, false, DID1, threadMod._encKeyId, DID2, subscribeMock)
    await threadMod2._load()
    await threadMod2._setIdentity(await THREEID3_MOCK.getOdbId())
    await threadMod2.deletePost(entryId)
    expect(await threadMod2.getPosts()).toEqual([])
  })

  it('user without being a moderator can NOT delete others posts', async () => {
    const threadName = randomThreadName()
    // create thread by mod, with members
    const threadMod = new Thread(threadName, replicatorMock, false, DID1, undefined, DID1, subscribeMock)
    await threadMod._load()
    await threadMod._setIdentity(await THREEID1_MOCK.getOdbId())
    await threadMod.addMember(DID2)
    await threadMod.addMember(DID3)

    // user 1, member adds post
    const threadUser1 = new Thread(threadName, replicatorMock, false, DID1, threadMod._encKeyId, DID2, subscribeMock)
    await threadUser1._load()
    await threadUser1._setIdentity(await THREEID2_MOCK.getOdbId())
    await threadUser1.post(MSG1)
    const posts = await threadUser1.getPosts()
    const entryId = posts[0].postId

    // user 2, member tries to delete post
    const threadUser2 = new Thread(threadName, replicatorMock, false, DID1, threadMod._encKeyId, DID2, subscribeMock)
    await threadUser2._load()
    await threadUser2._setIdentity(await THREEID3_MOCK.getOdbId())
    await expect(threadUser2.deletePost(entryId)).rejects.toThrow(/not append entry/)
  })

  it('user without being a moderator can delete their own posts', async () => {
    const threadName = randomThreadName()
    // create thread by mod, with member
    const threadMod = new Thread(threadName, replicatorMock, false, DID1, undefined, DID1, subscribeMock)
    await threadMod._load()
    await threadMod._setIdentity(await THREEID1_MOCK.getOdbId())
    await threadMod.addMember(DID2)

    // member write post
    const threadMember = new Thread(threadName, replicatorMock, false, DID1, threadMod._encKeyId, DID2, subscribeMock)
    await threadMember._load()
    await threadMember._setIdentity(await THREEID2_MOCK.getOdbId())
    await threadMember.post(MSG1)

    //Member delete their own post
    const posts = await threadMember.getPosts()
    const entryId = posts[0].postId
    await threadMember.deletePost(entryId)
    expect(await threadMember.getPosts()).toEqual([])
  })

  it('non member can NOT join a confidential thread', async () => {
    const threadName = randomThreadName()

    // create thread by mod, no members
    const threadMod = new Thread(threadName, replicatorMock, false, DID1, undefined, DID1, subscribeMock)
    await threadMod._load()
    await threadMod._setIdentity(await THREEID1_MOCK.getOdbId())

    // Non member try to post
    const threadMember = new Thread(threadName, replicatorMock, false, DID1, threadMod._encKeyId, DID2, subscribeMock)
    await threadMember._load()
    await expect(threadMember._setIdentity(await THREEID2_MOCK.getOdbId())).rejects.toThrow(/no access/)
  })

  it('a member can post in a confidential thread', async () => {
    const threadName = randomThreadName()

    // create thread by mod, with member
    const threadMod = new Thread(threadName, replicatorMock, false, DID1, undefined, DID1, subscribeMock)
    await threadMod._load()
    await threadMod._setIdentity(await THREEID1_MOCK.getOdbId())
    await threadMod.addMember(DID2)

    // member write post
    const threadMember = new Thread(threadName, replicatorMock, false, DID1, threadMod._encKeyId, DID2, subscribeMock)
    await threadMember._load()
    await threadMember._setIdentity(await THREEID2_MOCK.getOdbId())
    await threadMember.post(MSG1)
    const posts = await threadMember.getPosts()
    await expect(posts[0].message).toEqual(MSG1)
  })

  it('a member can NOT add a member', async () => {
    const threadName = randomThreadName()

    // create thread by mod, with member
    const threadMod = new Thread(threadName, replicatorMock, false, DID1, undefined, DID1, subscribeMock)
    await threadMod._load()
    await threadMod._setIdentity(await THREEID1_MOCK.getOdbId())
    await threadMod.addMember(DID2)

    // member tries to add member
    const threadMember = new Thread(threadName, replicatorMock, false, DID1, threadMod._encKeyId, DID2, subscribeMock)
    await threadMember._load()
    await threadMember._setIdentity(await THREEID2_MOCK.getOdbId())
    await expect(threadMember.addMember(DID3)).rejects.toThrow(/can not be granted/)
    expect(await threadMember.listMembers()).toEqual([DID2])
  })

  it('a member can NOT add a moderator', async () => {
    const threadName = randomThreadName()

    // create thread by mod, with member
    const threadMod = new Thread(threadName, replicatorMock, false, DID1, undefined, DID1, subscribeMock)
    await threadMod._load()
    await threadMod._setIdentity(await THREEID1_MOCK.getOdbId())
    await threadMod.addMember(DID2)

    // member tries to add member
    const threadMember = new Thread(threadName, replicatorMock, false, DID1, threadMod._encKeyId, DID2, subscribeMock)
    await threadMember._load()
    await threadMember._setIdentity(await THREEID2_MOCK.getOdbId())
    await expect(threadMember.addModerator(DID3)).rejects.toThrow(/can not be granted/)
    expect(await threadMember.listModerators()).toEqual([DID1])
  })


  it('a member upgraded to a moderator can add other mods', async () => {
    const threadName = randomThreadName()

    // create thread by mod, with member
    const threadMod = new Thread(threadName, replicatorMock, false, DID1, undefined, DID1, subscribeMock)
    await threadMod._load()
    await threadMod._setIdentity(await THREEID1_MOCK.getOdbId())
    await threadMod.addMember(DID2)
    await threadMod.addModerator(DID2)

    //now mod, adds mod
    const threadMember = new Thread(threadName, replicatorMock, false, DID1, threadMod._encKeyId, DID2, subscribeMock)
    await threadMember._load()
    await threadMember._setIdentity(await THREEID2_MOCK.getOdbId())
    await threadMember.addModerator(DID3)
    expect(await threadMember.listModerators()).toEqual([DID1, DID2, DID3])
  })

  it('a member upgraded to a moderator can add other members', async () => {
    const threadName = randomThreadName()

    // create thread by mod, with member
    const threadMod = new Thread(threadName, replicatorMock, false, DID1, undefined, DID1, subscribeMock)
    await threadMod._load()
    await threadMod._setIdentity(await THREEID1_MOCK.getOdbId())
    await threadMod.addMember(DID2)
    await threadMod.addModerator(DID2)

    //now mod, adds members
    const threadMember = new Thread(threadName, replicatorMock, false, DID1, threadMod._encKeyId, DID2, subscribeMock)
    await threadMember._load()
    await threadMember._setIdentity(await THREEID2_MOCK.getOdbId())
    await threadMember.addMember(DID3)
    expect(await threadMember.listMembers()).toEqual([DID2, DID3])
  })

  it('a thread can be loaded by its address only', async () => {
    const threadName = randomThreadName()
    const thread1 = new Thread(threadName, replicatorMock, false, DID1, undefined, DID1, subscribeMock)
    await thread1._load()
    await thread1._setIdentity(await THREEID1_MOCK.getOdbId())
    await thread1._initConfidential()
    await thread1.addMember(DID2)

    const thread1Address = thread1.address
    await thread1.post(MSG1)

    const thread2 = new ThreadImport(undefined, replicatorMock, undefined, undefined, undefined, userMock(DID2), subscribeMock)
    await thread2._load(thread1Address)
    await thread2._setIdentity(await THREEID2_MOCK.getOdbId())
    const thread2Address = thread2.address
    expect(thread2Address).toEqual(thread1Address)
    const posts = await thread2.getPosts()

    await expect(posts[0].message).toEqual(MSG1)
  })

  describe('multi user interaction', () => {
    let threadUser1
    let threadUser2
    let ipfs2
    let orbitdb2
    let replicatorMock2
    beforeAll(async () => {
      ipfs2 = await utils.initIPFS(25)
      let ipfsMultiAddr = (await ipfs.id()).addresses[0]
      await ipfs2.swarm.connect(ipfsMultiAddr)
      orbitdb2 = await OrbitDB.createInstance(ipfs2, {
        directory:'./tmp/orbitdb5'
      })
      replicatorMock2 = {
        _orbitdb: orbitdb2,
        ensureConnected: jest.fn()
      }
    })

    it('syncs thread between users', async () => {
      threadUser1 = new Thread(THREAD2_NAME, replicatorMock, false, DID1, undefined, DID1, subscribeMock)
      await threadUser1._load()
      await threadUser1._setIdentity(await THREEID1_MOCK.getOdbId())
      await threadUser1.addMember(DID2)


      threadUser2 = new Thread(THREAD2_NAME, replicatorMock2, false, DID1, threadUser1._encKeyId, DID2, subscribeMock)
      await threadUser2._load()
      await threadUser2._setIdentity(await THREEID2_MOCK.getOdbId())

      // user1 posts and user2 receives
      // done needed to not catch the write event
      let done = false
      let postPromise = new Promise((resolve, reject) => {
        threadUser2.onUpdate(post => {
          if (!done) {
            done = true
          }
          resolve()
        })
      })
      await threadUser1.post(MSG1)
      let posts1 = await threadUser1.getPosts()
      expect(posts1[0].author).toEqual(THREEID1_MOCK.DID)
      expect(posts1[0].message).toEqual(MSG1)
      await postPromise
      threadUser2.onUpdate(() => {})
      await new Promise((resolve, reject) => { setTimeout(resolve, 500) })
      let posts2 = await threadUser2.getPosts()
      expect(posts2[0].author).toEqual(THREEID1_MOCK.DID)
      expect(posts2[0].message).toEqual(MSG1)
      expect(posts2[0].postId).toEqual(posts1[0].postId)

      // user2 posts and user1 receives
      postPromise = new Promise((resolve, reject) => {
        threadUser1.onUpdate(() => {
          resolve()
        })
      })
      await threadUser2.post(MSG2)
      posts2 = await threadUser2.getPosts()
      expect(posts2[1].author).toEqual(THREEID2_MOCK.DID)
      expect(posts2[1].message).toEqual(MSG2)
      await postPromise
      await new Promise((resolve, reject) => { setTimeout(resolve, 500) })
      posts1 = await threadUser1.getPosts()
      expect(posts1[1].author).toEqual(THREEID2_MOCK.DID)
      expect(posts1[1].message).toEqual(MSG2)
      expect(posts1[1].postId).toEqual(posts2[1].postId)
    })

    it('moderator capabilities are shared/synced between users', async () => {
        const threadName = randomThreadName()

      threadUser1 = new Thread(threadName, replicatorMock, false, DID1, undefined, DID1, subscribeMock)
      await threadUser1._load()
      await threadUser1._setIdentity(await THREEID1_MOCK.getOdbId())
      await threadUser1.addMember(DID2)

      threadUser2 = new Thread(threadName, replicatorMock2, false, DID1, threadUser1._encKeyId, DID2, subscribeMock)
      await threadUser2._load()
      await threadUser2._setIdentity(await THREEID2_MOCK.getOdbId())

      // user two tries to add a moderator and fails
      await expect(threadUser2.addModerator(DID3)).rejects.toThrow(/can not be granted/)
      expect(await threadUser2.listModerators()).toEqual([DID1])
      expect(await threadUser1.listModerators()).toEqual([DID1])

      // user1 add user2 as modes, wait for AC update
      let updatePromise = new Promise((resolve, reject) => {
        threadUser2.onNewCapabilities(async () => {
          const mods = await threadUser2.listModerators()
          if (mods.includes(DID2)) resolve()
        })
      })

      // user one adds user 2 as mod
      await threadUser1.addModerator(DID2)
      await updatePromise

      expect(await threadUser2.listModerators()).toEqual([DID1, DID2])
      expect(await threadUser1.listModerators()).toEqual([DID1, DID2])

      // user 2 adds another mod succsesfully now
      await threadUser2.addModerator(DID3)
      expect(await threadUser2.listModerators()).toEqual([DID1, DID2, DID3])
    })

    it('member capabilities are shared/synced between users', async () => {
      const threadName = randomThreadName()
      threadUser1 = new Thread(threadName, replicatorMock, false, DID1, undefined, DID1, subscribeMock)
      await threadUser1._load()
      await threadUser1._setIdentity(await THREEID1_MOCK.getOdbId())

      threadUser2 = new Thread(threadName, replicatorMock2, false, DID1, threadUser1._encKeyId, DID2, subscribeMock)
      await threadUser2._load()
      await expect(threadUser2._setIdentity(await THREEID2_MOCK.getOdbId())).rejects.toThrow(/no access/)

      // user one adds user 2 as member
      await threadUser1.addMember(DID2)
      await threadUser2._setIdentity(await THREEID2_MOCK.getOdbId())
      expect(await threadUser2.listMembers()).toEqual([DID2])
      expect(await threadUser1.listMembers()).toEqual([DID2])

      // user 2 adds a post now
      await threadUser2.post(MSG1)
      const posts = await threadUser2.getPosts()
      await expect(posts[0].message).toEqual(MSG1)
    })

    afterAll(async () => {
      await orbitdb2.stop()
      return ipfs2.stop()
    })
  })

  afterAll(async () => {
    await orbitdb.stop()
    return ipfs.stop()
  })
})
