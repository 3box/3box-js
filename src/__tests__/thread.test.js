const utils = require('./testUtils')
const Thread = require('../thread')
const OrbitDB = require('orbit-db')
const {
  OdbIdentityProvider,
  LegacyIPFS3BoxAccessController,
  ThreadAccessController,
  ModeratorAccessController
} = require('3box-orbitdb-plugins')
const Identities = require('orbit-db-identity-provider')
Identities.addIdentityProvider(OdbIdentityProvider)
const AccessControllers = require('orbit-db-access-controllers')
AccessControllers.addAccessController({ AccessController: LegacyIPFS3BoxAccessController })
AccessControllers.addAccessController({ AccessController: ThreadAccessController })
AccessControllers.addAccessController({ AccessController: ModeratorAccessController })
const didJWT = require('did-jwt')
const EC = require('elliptic').ec
const ec = new EC('secp256k1')
const { registerMethod } = require('did-resolver')


const DID1 = 'did:3:zdpuAsaK9YsqpphSBeQvfrKAjs8kF7vUX4Y3kMkMRgEQigzCt'
const DID2 = 'did:3:zdpuB2DcKQKNBDz3difEYxjTupsho5VuPCLgRbRunXqhmrJaX'
const DID3 = 'did:3:zdpuAvKY6Noex9nRMp1pR8dHauT5Rn4yhVuLq9bAdz4pp5oRd'


const didResolver = async (did) => {
  return {
    '@context': 'https://w3id.org/did/v1',
    'id': did,
    'publicKey': [{
      'id': `${did}#signingKey`,
      'type': 'Secp256k1VerificationKey2018',
      'publicKeyHex': '044f5c08e2150b618264c4794d99a22238bf60f1133a7f563e74fcf55ddb16748159872687a613545c65567d2b7a4d4e3ac03763e1d9a5fcfe512a371faa48a781'
    }],
    'authentication': [{
      'type': 'Secp256k1SignatureAuthentication2018',
      'publicKey': `${did}#signingKey`
    }]
  }
}

registerMethod('3', didResolver)


const threeIDMock = (did) => {
  const signJWT = payload => {
    return didJWT.createJWT(payload, {
      signer: didJWT.SimpleSigner('95838ece1ac686bde68823b21ce9f564bc536eebb9c3500fa6da81f17086a6be'),
      issuer: did
    })
  }

  const getKeyringBySpaceName = () => {
    return {
      getPublicKeys: () => {
        return { signingKey: '044f5c08e2150b618264c4794d99a22238bf60f1133a7f563e74fcf55ddb16748159872687a613545c65567d2b7a4d4e3ac03763e1d9a5fcfe512a371faa48a781' }
      }
    }
  }

  const getSubDID = () => did

  const getOdbId = () => {
    return Identities.createIdentity({
      type: '3ID',
      threeId: {signJWT, getKeyringBySpaceName, DID: did, getSubDID},
      identityKeysPath: `./tmp/${did}`
    })
  }

  return {
    DID: did,
    signJWT,
    getKeyringBySpaceName,
    getOdbId,
    getSubDID
  }
}


const THREAD1_NAME = '3box.thread.somespace.name1'
const THREAD2_NAME = '3box.thread.somespace.name2'
const THREAD3_NAME = '3box.thread.somespace.name2'

const randomThreadName = () => `3box.thread.somespace.name${Math.floor(Math.random() * 1000)}`

const MSG1 = 'message1'
const MSG2 = 'message2'
const MSG3 = 'message3'
const MSG4 = 'message4'

const THREEID1_MOCK = threeIDMock(DID1)
const THREEID2_MOCK = threeIDMock(DID2)

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
    orbitdb = await OrbitDB.createInstance(ipfs, {
      directory:'./tmp/orbitdb4'
    })
  })

  beforeEach(() => {
    ensureConnected.mockClear()
    subscribeMock.mockClear()
  })

  it('creates thread correctly', async () => {
    thread = new Thread(orbitdb, THREAD1_NAME, THREEID1_MOCK, false, DID1, subscribeMock, ensureConnected)
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
    expect(posts[0].author).toEqual(THREEID1_MOCK.DID)
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

  it('defaults to user as root moderator and no members ', async () => {
    const threadDefault = new Thread(orbitdb, THREAD3_NAME, THREEID1_MOCK, undefined, undefined, subscribeMock, ensureConnected)
    expect(threadDefault._rootMod).toEqual(THREEID1_MOCK.DID)
    expect(threadDefault._membersOnly).toEqual(false)
    await threadDefault._load()
    const moderators = await threadDefault.listModerators()
    expect(moderators).toEqual([THREEID1_MOCK.DID])
  })

  it('root moderator can add another moderator', async () => {
    const threadMods = new Thread(orbitdb, THREAD3_NAME, THREEID1_MOCK, false, DID1, subscribeMock, ensureConnected)
    await threadMods._load()
    expect(await threadMods.listModerators()).toEqual([DID1])
    await threadMods.addModerator(DID2)
    expect(await threadMods.listModerators()).toEqual([DID1, DID2])
  })

  it('user without being a moderator can NOT add a moderator', async () => {
    const threadMods = new Thread(orbitdb, THREAD3_NAME, THREEID1_MOCK, false, DID2, subscribeMock, ensureConnected)
    await threadMods._load()
    expect(await threadMods.listModerators()).toEqual([DID2])
    await expect(threadMods.addModerator(DID3)).rejects.toThrow(/can not be granted/)
    expect(await threadMods.listModerators()).toEqual([DID2])
  })

  it('a moderator can add another moderator', async () => {
    const threadName = randomThreadName()
    const threadMod1 = new Thread(orbitdb, threadName, THREEID1_MOCK, false, DID1, subscribeMock, ensureConnected)
    await threadMod1._load()
    expect(await threadMod1.listModerators()).toEqual([DID1])
    await threadMod1.addModerator(DID2)
    expect(await threadMod1.listModerators()).toEqual([DID1, DID2])
    const threadMod2 = new Thread(orbitdb, threadName, THREEID2_MOCK, false, DID1, subscribeMock, ensureConnected)
    await threadMod2._load()
    await threadMod2.addModerator(DID3)
    expect(await threadMod2.listModerators()).toEqual([DID1, DID2, DID3])
  })

  it('moderator can add a Member', async () => {
    const threadName = randomThreadName()
    const threadMembers = new Thread(orbitdb, threadName, THREEID1_MOCK, true, DID1, subscribeMock, ensureConnected)
    await threadMembers._load()
    expect(await threadMembers.listMembers()).toEqual([])
    await threadMembers.addMember(DID2)
    expect(await threadMembers.listMembers()).toEqual([DID2])
  })

  it('user without being a moderator can NOT add a Member', async () => {
    const threadName = randomThreadName()
    const threadMembers = new Thread(orbitdb, threadName, THREEID1_MOCK, true, DID2, subscribeMock, ensureConnected)
    await threadMembers._load()
    await expect(threadMembers.addMember(DID3)).rejects.toThrow(/can not be granted/)
    expect(await threadMembers.listMembers()).toEqual([])
  })

  it('throws if using member operations on a non member thread', async () => {
    const threadName = randomThreadName()
    const threadMembers = new Thread(orbitdb, threadName, THREEID1_MOCK, false, DID1, subscribeMock, ensureConnected)
    await threadMembers._load()
    await expect(threadMembers.addMember(DID2)).rejects.toThrow(/Not a members only thread/)
  })

  it('a moderator can delete other users posts', async () => {
    const threadName = randomThreadName()
    const thread1 = new Thread(orbitdb, threadName, THREEID1_MOCK, false, DID2, subscribeMock, ensureConnected)
    await thread1._load()
    await thread1.post(MSG1)
    const posts = await thread1.getPosts()
    const entryId = posts[0].postId
    const thread2 = new Thread(orbitdb, threadName, THREEID2_MOCK, false, DID2, subscribeMock, ensureConnected)
    await thread2._load()
    console.log(await thread2.deletePost(entryId))
    expect(await thread2.getPosts()).toEqual([])
  })

  it('a moderator can NOT delete other moderator posts', async () => {
    const threadName = randomThreadName()
    const thread1 = new Thread(orbitdb, threadName, THREEID1_MOCK, false, DID1, subscribeMock, ensureConnected)
    await thread1._load()
    await thread1.post(MSG1)
    const posts = await thread1.getPosts()
    await thread1.addModerator(DID2)
    expect(await thread1.listModerators()).toEqual([DID1, DID2])
    const entryId = posts[0].postId
    const thread2 = new Thread(orbitdb, threadName, THREEID2_MOCK, false, DID1, subscribeMock, ensureConnected)
    await thread2._load()
    await expect(thread2.deletePost(entryId)).rejects.toThrow(/not append entry/)
  })

  it('user without being a moderator can NOT delete others posts', async () => {
    const threadName = randomThreadName()
    const thread1 = new Thread(orbitdb, threadName, THREEID1_MOCK, false, DID3, subscribeMock, ensureConnected)
    await thread1._load()
    await thread1.post(MSG1)
    const posts = await thread1.getPosts()
    const entryId = posts[0].postId
    const thread2 = new Thread(orbitdb, threadName, THREEID2_MOCK, false, DID3, subscribeMock, ensureConnected)
    await thread2._load()
    await expect(thread2.deletePost(entryId)).rejects.toThrow(/not append entry/)
  })

  it('user without being a moderator can delete their own posts', async () => {
    const threadName = randomThreadName()
    const thread = new Thread(orbitdb, threadName, THREEID1_MOCK, false, DID3, subscribeMock, ensureConnected)
    await thread._load()
    await thread.post(MSG1)
    const posts = await thread.getPosts()
    const entryId = posts[0].postId
    await thread.deletePost(entryId)
    expect(await thread.getPosts()).toEqual([])
  })

  it('non member can NOT post to a members thread', async () => {
    const threadName = randomThreadName()
    const thread1 = new Thread(orbitdb, threadName, THREEID1_MOCK, true, DID3, subscribeMock, ensureConnected)
    await thread1._load()
    await expect(thread1.post(MSG1)).rejects.toThrow(/not append entry/)
  })

  it('a member can post in a members only thread', async () => {
    const threadName = randomThreadName()
    const thread1 = new Thread(orbitdb, threadName, THREEID1_MOCK, true, DID1, subscribeMock, ensureConnected)
    await thread1._load()
    await thread1.addMember(DID2)
    expect(await thread1.listMembers()).toEqual([DID2])
    const thread2 = new Thread(orbitdb, threadName, THREEID2_MOCK, true, DID1, subscribeMock, ensureConnected)
    await thread2._load()
    await thread2.post(MSG1)
    const posts = await thread.getPosts()
    await expect(posts[0].message).toEqual(MSG1)
  })

  it('a moderator can post in a members only thread', async () => {
    const threadName = randomThreadName()
    const thread1 = new Thread(orbitdb, threadName, THREEID1_MOCK, true, DID1, subscribeMock, ensureConnected)
    await thread1._load()
    await thread1.addModerator(DID2)
    expect(await thread1.listModerators()).toEqual([DID1, DID2])
    const thread2 = new Thread(orbitdb, threadName, THREEID2_MOCK, true, DID1, subscribeMock, ensureConnected)
    await thread2._load()
    await thread2.post(MSG1)
    const posts = await thread.getPosts()
    await expect(posts[0].message).toEqual(MSG1)
  })

  it('share AC UPDATES ', async () => {
    // TODO
    //  ......
    // and some other async conditions
  })

  describe('multi user interaction', () => {
    let threadUser1
    let threadUser2
    let ipfs2
    let orbitdb2
    beforeAll(async () => {
      ipfs2 = await utils.initIPFS(5)
      orbitdb2 = await OrbitDB.createInstance(ipfs2, {
        directory:'./tmp/orbitdb5'
      })
    })

    it('syncs thread between users', async () => {
      threadUser1 = new Thread(orbitdb, THREAD2_NAME, THREEID1_MOCK,false, DID1, subscribeMock, ensureConnected)
      await threadUser1._load()
      threadUser2 = new Thread(orbitdb2, THREAD2_NAME, THREEID2_MOCK, false, DID1,subscribeMock, ensureConnected)
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
      expect(posts1[0].author).toEqual(THREEID1_MOCK.DID)
      expect(posts1[0].message).toEqual(MSG1)
      await postPromise
      threadUser2.onNewPost(() => {})
      await new Promise((resolve, reject) => { setTimeout(resolve, 500) })
      let posts2 = await threadUser2.getPosts()
      expect(posts2[0].author).toEqual(THREEID1_MOCK.DID)
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
      expect(posts2[1].author).toEqual(THREEID2_MOCK.DID)
      expect(posts2[1].message).toEqual(MSG2)
      await postPromise
      await new Promise((resolve, reject) => { setTimeout(resolve, 500) })
      posts1 = await threadUser1.getPosts()
      expect(posts1[1].author).toEqual(THREEID2_MOCK.DID)
      expect(posts1[1].message).toEqual(MSG2)
      expect(posts1[1].postId).toEqual(posts2[1].postId)
    })

    afterAll(async () => {
      await orbitdb2.stop()
      await utils.stopIPFS(ipfs2, 5)
    })
  })

  afterAll(async () => {
    await orbitdb.stop()
    await utils.stopIPFS(ipfs, 4)
  })
})
