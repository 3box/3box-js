const utils = require('./testUtils')
const GhostChat = require('../ghost')

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
    ipfs = await utils.initIPFS(4);
  })

  beforeEach(async () => {
    jest.setTimeout(2000000)
  })

  it('creates chat correctly', async () => {
    chat = new GhostChat(CHAT_NAME, { ipfs }, THREEID1_MOCK);
    expect(chat.name).toEqual(CHAT_NAME)
    expect(chat._3id).toEqual(THREEID1_MOCK)
    expect(chat.onlineUsers).toBeDefined()
    expect(chat.backlog).toBeDefined()
  })

  it('should catch messages', async (done) => {
    chat.on('message', ({ from, message }) => {
      expect(from).toEqual(DID1)
      expect(chat.backlog).not.toEqual([])
      expect(chat.backlog).toBeDefined()
      done()
    })
    await chat.post('hello')
  })

  describe('multi user interaction', () => {
    let chat2
    let ipfs2

    beforeAll(async () => {
      ipfs2 = await utils.initIPFS(5)
    })

    it('creates second chat correctly', async (done) => {
      chat2 = new GhostChat(CHAT_NAME, { ipfs: ipfs2 }, THREEID2_MOCK);
      expect(chat2.name).toEqual(CHAT_NAME)
      expect(chat2._3id).toEqual(THREEID2_MOCK)
      expect(chat2.onlineUsers).toBeDefined()
      expect(chat2.backlog).toBeDefined()

      // checks if chat2 joined properly
      chat.on('user-joined', (did, peerId) => {
        expect(chat.onlineUsers).toEqual(expect.arrayContaining([DID2]))
        expect(chat2.onlineUsers).toEqual(expect.arrayContaining([DID1]))
        done()
      })
    })

    it('chat2 should catch broadcasts from chat', async (done) => {
      chat.removeAllListeners('message')
      chat2.removeAllListeners('message')
      chat2.on('message', ({ from, message }) => {
        expect(from).toEqual(DID1)
        expect(message).toEqual('wide')
        expect(chat2.backlog.pop()).toEqual({ type: 'chat', from: DID1, message: 'wide' })
        done()
      })
      await chat.post('wide')
    })

    it('chat2 should catch peer dms from chat', async (done) => {
      chat.removeAllListeners('message')
      chat2.removeAllListeners('message')
      chat2.on('message', ({ from, message }) => {
        expect(from).toEqual(DID1)
        expect(message).toEqual('direct peer')
        expect(chat2.backlog.pop()).toEqual({ type: 'chat', from: DID1, message: 'direct peer' })
        done()
      })
      await chat.post('direct peer', chat2.peerId)
    })

    it('chat2 should catch 3id dms from chat', async (done) => {
      chat.removeAllListeners('message')
      chat2.removeAllListeners('message')
      chat2.on('message', ({ from, message }) => {
        expect(from).toEqual(DID1)
        expect(message).toEqual('direct 3id')
        expect(chat2.backlog.pop()).toEqual({ type: 'chat', from: DID1, message: 'direct 3id' })
        done()
      })
      await chat.post('direct 3id', DID2)
    })

    it('should request backlog from chat2', async (done) => {
      chat.removeAllListeners('message')
      chat2.removeAllListeners('message')
      chat.on('message', ({ from, message }) => {
        expect(chat2.backlog).toEqual(message)
        done()
      })
      await chat.requestBacklog()
    })

    afterAll(async () => {
      await utils.stopIPFS(ipfs2, 5)
    })
  })

  afterAll(async () => {
    await utils.stopIPFS(ipfs, 4)
  })
})
