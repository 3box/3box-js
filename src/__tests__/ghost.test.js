jest.mock('3id-resolver', () => {
  const { didResolverMock } = require('../__mocks__/3ID')
  return {
    getResolver: () => ({ '3': didResolverMock })
  }
})

const utils = require('./testUtils')
const GhostThread = require('../ghost')

const { threeIDMockFactory } = require('../__mocks__/3ID')

const DID1 = 'did:3:zdpuAsaK9YsqpphSBeQvfrKAjs8kF7vUX4Y3kMkMRgEQigzCt'
const DID2 = 'did:3:zdpuB2DcKQKNBDz3difEYxjTupsho5VuPCLgRbRunXqhmrJaX'
const DID3 = 'did:3:zdpuAvKY6Noex9nRMp1pR8dHauT5Rn4yhVuLq9bAdz4pp5oRd'
const DID4 = 'did:3:bafyreifgwegkzk6rxemfck2vfm2zpw223hkl37eqvtms6gdwu2ejnbkrly'

const CHAT_NAME = '3box.chat.somespace.name'

const THREEID1_MOCK = threeIDMockFactory(DID1)
const THREEID2_MOCK = threeIDMockFactory(DID2)
const THREEID3_MOCK = threeIDMockFactory(DID3)
const THREEID4_MOCK = threeIDMockFactory(DID4)

describe('Ghost Chat', () => {
  let ipfs
  let chat
  let chat2
  let peer
  const user = 0
  // jest.setTimeout(2000000)

  beforeAll(async () => {
    ipfs = await utils.initIPFS(11)
  })

  beforeEach(async () => {
    jest.setTimeout(30000)
  })

  afterAll(async () => {
    await chat.close()
    await ipfs.stop()
  })

  it('creates chat correctly', async () => {
    chat = new GhostThread(CHAT_NAME, { ipfs })
    expect(chat._name).toEqual(CHAT_NAME)
    expect(chat.listMembers).toBeDefined()
    expect(chat.getPosts()).toBeDefined()
    expect(chat.isGhost).toBeTruthy()
    chat._set3id(THREEID1_MOCK)
    expect(chat._3id).toEqual(THREEID1_MOCK)
  })

  it('should catch messages', async () => {
    const postPromise = new Promise(resolve => {
      chat.onUpdate(async ({ type, author, message }) => {
        if (type == 'chat') {
          expect(author).toEqual(DID1)
          expect(chat.getPosts()).not.toEqual([])
          expect(chat.getPosts()).toBeDefined()
          resolve()
        }
      })
    })
    await chat.post('hello')
    await postPromise
  })

  describe('multi user interaction', () => {
    let chat2
    let ipfs2

    beforeAll(async () => {
      ipfs2 = await utils.initIPFS(12)
      let ipfsMultiAddr = (await ipfs.id()).addresses[0]
      await ipfs2.swarm.connect(ipfsMultiAddr)
    })

    afterAll(async () => {
      await chat2.close()
      await ipfs2.stop()
    })

    it('creates second chat correctly', async () => {
      // checks if chat2 joined properly
      const c1Promise = new Promise(resolve => {
        chat.on('user-joined', async (_event, did, peerId) => {
          expect(_event).toEqual('joined')
          const members = await chat.listMembers()
          expect(members).toEqual(expect.arrayContaining([DID2]))
          resolve()
        })
      })
      chat2 = new GhostThread(CHAT_NAME, { ipfs: ipfs2 })
      const c2Promise = new Promise(resolve => {
        chat2.on('user-joined', async (_event, did, peerId) => {
          expect(_event).toEqual('joined')
          const members2 = await chat2.listMembers()
          expect(members2).toEqual(expect.arrayContaining([DID1]))
          resolve()
        })
      })
      chat2._set3id(THREEID2_MOCK)
      expect(chat2._name).toEqual(CHAT_NAME)
      expect(chat2._3id).toEqual(THREEID2_MOCK)
      expect(chat2.listMembers()).toBeDefined()
      expect(chat2.getPosts()).toBeDefined()
      await c1Promise
      await c2Promise
    })

    it('chat2 should catch broadcasts from chat', async (done) => {
      chat2.onUpdate(async ({ type, author, message }) => {
        if (type == 'chat') {
          expect(author).toEqual(DID1)
          expect(message).toEqual('wide')
          const posts = await chat2.getPosts()
          const post = posts.pop()
          expect(post).toMatchObject({ type: 'chat', author: DID1, message: 'wide' })
          expect(post).toHaveProperty('postId')
          expect(post).toHaveProperty('timestamp')
          done()
        }
      })
      await chat.post('wide')
    })

    it('chat2 should catch peer dms from chat', async (done) => {
      chat2.onUpdate(async ({ type, author, message }) => {
        if (type == 'chat') {
          expect(author).toEqual(DID1)
          expect(message).toEqual('direct peer')
          const posts = await chat2.getPosts()
          const post = posts.pop()
          expect(post).toMatchObject({ type: 'chat', author: DID1, message: 'direct peer' })
          expect(post).toHaveProperty('postId')
          expect(post).toHaveProperty('timestamp')
          done()
        }
      })
      await chat.post('direct peer', chat2.peerId)
    })

    it('chat2 should catch 3id dms from chat', async (done) => {
      chat2.onUpdate(async ({ type, author, message }) => {
        if (type == 'chat') {
          expect(author).toEqual(DID1)
          expect(message).toEqual('direct 3id')
          const posts = await chat2.getPosts()
          const post = posts.pop()
          expect(post).toMatchObject({ type: 'chat', author: DID1, message: 'direct 3id' })
          expect(post).toHaveProperty('postId')
          expect(post).toHaveProperty('timestamp')
          done()
        }
      })
      await chat.post('direct 3id', DID2)
    })

    it('should request backlog from chat2', async (done) => {
      chat.removeAllListeners('backlog-received')
      chat.onUpdate(async ({ type, message }) => {
        if (type == 'backlog') {
          const posts = await chat2.getPosts()
          expect(message).toEqual(posts)
          done()
        }
      })
      await chat._requestBacklog()
    })
  })

  describe('ghost filter tests', () => {
    let chat3
    let ipfs3
    const filter = (payload, issuer, from) => {
      if (issuer == DID1) {
        return false
      }
      return true
    }

    beforeAll(async () => {
      ipfs3 = await utils.initIPFS(12)
      let ipfsMultiAddr = (await ipfs.id()).addresses[0]
      await ipfs3.swarm.connect(ipfsMultiAddr)
    })

    afterAll(async () => {
      await chat3.close()
      await ipfs3.stop()
    })

    it('creates third chat correctly', async (done) => {
      chat.removeAllListeners()
      chat3 = new GhostThread(CHAT_NAME, { ipfs: ipfs3 }, { ghostFilters: [filter] })
      chat3._set3id(THREEID3_MOCK)
      expect(chat3._name).toEqual(CHAT_NAME)
      expect(chat3._3id).toEqual(THREEID3_MOCK)
      expect(chat3.listMembers()).toBeDefined()
      expect(chat3.getPosts()).toBeDefined()

      // checks if chat3 joined properly
      chat.on('user-joined', async (_event, did, peerId) => {
        expect(_event).toEqual('joined')
        expect(did).toEqual(DID3)
        done()
      })
    })

    it('chat3 should not catch broadcasts from chat', async (done) => {
      chat.removeAllListeners()
      chat.onUpdate(async ({ type, author, message }) => {
        // chat3 should not have the same backlog as chat
        // because messages from DID1 (and by extension chat) are being ignored
        if (message = 'wide') {
          const posts = await chat.getPosts()
          const posts3 = await chat3.getPosts()
          expect(posts).not.toEqual(posts3)
          done()
        }
      })
      await chat.post('wide')
    })
  })

  describe('Ghost Pinbot interaction', () => {
    let ipfs4
    let chat4
    let ipfsGhost
    let chatGhost
    let ghostMultiaddr

    const GHOST_PINBOT_CHAT_NAME = '3box.chat.somespace-ghost.name-ghost'

    beforeAll(async () => {
      ipfs4 = await utils.initIPFS(14)
      ipfsGhost = await utils.initIPFS(15)

      let ghostMultiaddr = (await ipfsGhost.id()).addresses[0]
      await ipfs4.swarm.connect(ghostMultiaddr)
    })

    afterAll(async () => {
      await chat4.close()
      await chatGhost.close()

      await ipfs4.stop()
      return ipfsGhost.stop()
    })

    it('creates Ghost Pinbot correctly', async () => {
      chatGhost = new GhostThread(GHOST_PINBOT_CHAT_NAME, { ipfs: ipfsGhost })
      expect(chatGhost._name).toEqual(GHOST_PINBOT_CHAT_NAME)
      expect(chatGhost.listMembers).toBeDefined()
      expect(chatGhost.getPosts()).toBeDefined()
      expect(chatGhost.isGhost).toBeTruthy()
    })

    it('creates fourth chat correctly', async (done) => {
      // checks if chat4 joined properly
      const gPromise = new Promise(resolve => {
        chatGhost.onUpdate(async (msg) => {
          if (msg.type === 'backlog') {
            resolve()
          }
        })

        chatGhost.on('backlog_response', async (_event, did, peerId) => {
          expect(_event).toEqual('joined')
          const members = await chatGhost.listMembers()
          expect(members).toEqual(expect.arrayContaining([DID4]))
          resolve()
        })
      })

      chat4 = new GhostThread(GHOST_PINBOT_CHAT_NAME, { ipfs: ipfs4 }, {
        ghostPinbot: ghostMultiaddr
      })

      chat4.onUpdate(async ({ type, author, message }) => {
        if (type === 'backlog') {
          expect(author).toBeUndefined()
          const members4 = await chat4.listMembers()
          expect(members4).toEqual([])
          done()
        }
      })

      chat4._set3id(THREEID4_MOCK)
      expect(chat4._name).toEqual(GHOST_PINBOT_CHAT_NAME)
      expect(chat4._3id).toEqual(THREEID4_MOCK)
      expect(chat4.listMembers()).toBeDefined()
      expect(chat4.getPosts()).toBeDefined()
      await gPromise
    })
  })

  afterAll(async () => {
    await chat.close()
    return utils.stopIPFS(ipfs, 11)
  })
})
