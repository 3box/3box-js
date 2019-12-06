const utils = require('./testUtils')
const GhostThread = require('../ghost')

const { threeIDMockFactory, didResolverMock } = require('../__mocks__/3ID')

const DID1 = 'did:3:zdpuAsaK9YsqpphSBeQvfrKAjs8kF7vUX4Y3kMkMRgEQigzCt'
const DID2 = 'did:3:zdpuB2DcKQKNBDz3difEYxjTupsho5VuPCLgRbRunXqhmrJaX'
const DID3 = 'did:3:zdpuAvKY6Noex9nRMp1pR8dHauT5Rn4yhVuLq9bAdz4pp5oRd'

const CHAT_NAME = '3box.chat.somespace.name'

const THREEID1_MOCK = threeIDMockFactory(DID1);
const THREEID2_MOCK = threeIDMockFactory(DID2);
const THREEID3_MOCK = threeIDMockFactory(DID3);

const { registerMethod } = require('did-resolver')

registerMethod('3', didResolverMock)
didResolverMock(THREEID1_MOCK);

describe('Ghost Chat', () => {
  let ipfs
  let chat
  let chat2
  let peer
  let user = 0
  // jest.setTimeout(2000000)

  beforeAll(async () => {
    ipfs = await utils.initIPFS(11);
  })

  beforeEach(async () => {
    jest.setTimeout(20000)
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

  it('should catch messages', async (done) => {
    chat.onUpdate(async ({ type, author, message }) => {
      if (type == 'chat') {
        expect(author).toEqual(DID1)
        expect(chat.getPosts()).not.toEqual([])
        expect(chat.getPosts()).toBeDefined()
        done()
      }
    })
    await chat.post('hello')
  })

  describe('multi user interaction', () => {
    let chat2
    let ipfs2

    beforeAll(async () => {
      ipfs2 = await utils.initIPFS(12)
    })

    it('creates second chat correctly', async (done) => {
      chat2 = new GhostThread(CHAT_NAME, { ipfs: ipfs2 });
      chat2._set3id(THREEID2_MOCK)
      expect(chat2._name).toEqual(CHAT_NAME)
      expect(chat2._3id).toEqual(THREEID2_MOCK)
      expect(chat2.listMembers()).toBeDefined()
      expect(chat2.getPosts()).toBeDefined()

      // checks if chat2 joined properly
      chat.on('user-joined', async (_event, did, peerId) => {
        expect(_event).toEqual('joined')
        const members = await chat.listMembers()
        const members2 = await chat2.listMembers()
        expect(members).toEqual(expect.arrayContaining([DID2]))
        expect(members2).toEqual(expect.arrayContaining([DID1]))
        done()
      })
    })

    it('chat2 should catch broadcasts from chat', async (done) => {
      chat2.onUpdate(async ({ type, author, message }) => {
        if (type == 'chat') {
          expect(author).toEqual(DID1)
          expect(message).toEqual('wide')
          const posts = await chat2.getPosts()
          const post = posts.pop()
          delete post.timestamp // since we have no way to get it from onUpdate
          expect(post).toEqual({ type: 'chat', author: DID1, message: 'wide' })
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
          delete post.timestamp // since we have no way to get it from onUpdate
          expect(post).toEqual({ type: 'chat', author: DID1, message: 'direct peer' })
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
          delete post.timestamp // since we have no way to get it from onUpdate
          expect(post).toEqual({ type: 'chat', author: DID1, message: 'direct 3id' })
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

    afterAll(async () => {
      await utils.stopIPFS(ipfs2, 12)
    })
  })

  describe('ghost filter tests', () => {
    let chat3
    let ipfs3
    let filter = (payload, issuer, from) => {
      if (issuer == DID1) {
          return false
      }
      return true
    }

    it('creates third chat correctly', async (done) => {
      chat.removeAllListeners()
      chat3 = new GhostThread(CHAT_NAME, { ipfs: ipfs3 }, { ghostFilters: [filter] });
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

    beforeAll(async () => {
      ipfs3 = await utils.initIPFS(12)
    })

    afterAll(async () => {
      await utils.stopIPFS(ipfs3, 12)
    })
  })

  afterAll(async () => {
    await utils.stopIPFS(ipfs, 11)
  })
})
