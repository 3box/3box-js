jest.mock('../keyValueStore')
jest.mock('../thread')
const Thread = require('../thread')
const ORBITDB = 'orbitdb instance'
let authenticated = false
const threeIdMock = {
  isAuthenticated: jest.fn(() => {
    return authenticated
  }),
  authenticate: jest.fn(),
  hashDBKey: jest.fn(key => `${key}asdfasdfasdf`),
  encrypt: data => { return { ciphertext: 'wow, such encrypted/' + data, nonce: 123 } },
  decrypt: ({ciphertext, nonce}) => ciphertext.split('/')[1],
  signJWT: (payload, { space }) => {
    return `a fake jwt for ${space}`
  },
  getOdbId: async () => 'odbid',
  getSubDID: (space) => `subdid-${space}`
}
const replicatorMock = 'replicator'
let rootstoreMockData = []
const rootstoreMock = {
  iterator: () => { return { collect: () => rootstoreMockData } },
  add: jest.fn(),
  del: jest.fn()
}

const Space = require('../space')


describe('Space', () => {

  let space
  let NAME1 = 'test1'
  let NAME2 = 'test2'

  beforeEach(() => {
    rootstoreMock.add.mockClear()
    threeIdMock.isAuthenticated.mockClear()
    threeIdMock.authenticate.mockClear()
  })

  it('should be correctly constructed', async () => {
    space = new Space(NAME1, replicatorMock)
    expect(space._name).toEqual(NAME1)
    expect(space._store._replicator).toEqual(replicatorMock)
    expect(space._store._name).toEqual('3box.space.' + NAME1 + '.keyvalue')
    expect(space.isOpen).toBeFalsy()
  })

  it('should open a new space correctly', async () => {
    let opts = {
      consentCallback: jest.fn(),
    }
    const syncDonePromise = new Promise((resolve, reject) => {
      opts.onSyncDone = resolve
    })
    await space.open(threeIdMock, opts)
    expect(space.isOpen).toBeTruthy()
    expect(opts.consentCallback).toHaveBeenCalledWith(true, NAME1)
    //expect(rootstoreMock.add).toHaveBeenCalledWith({ type: 'space', DID: threeIdMock.getSubDID(NAME1), odbAddress:'/orbitdb/myodbaddr' })
    expect(threeIdMock.isAuthenticated).toHaveBeenCalledWith([NAME1])
    expect(threeIdMock.authenticate).toHaveBeenCalledWith([NAME1])
    await syncDonePromise
  })

  it('should return directly if space already opened', async () => {
    let opts = {
      consentCallback: jest.fn(),
    }
    await space.open(threeIdMock, opts)
    expect(opts.consentCallback).toHaveBeenCalledTimes(0)
  })

  describe('public store reducer', () => {
    it('get/set/remove works correctly', async () => {
      await space.public.set('k1', 'v1')
      await space.public.set('k2', 'v2')
      await space.public.set('k3', 'v3')
      expect(await space.public.get('k1')).toEqual('v1')
      expect(await space.public.get('k2')).toEqual('v2')
      const entry = await space.public.get('k3', { metadata: true })
      expect(entry.value).toEqual('v3')
      expect(entry.timestamp).toBeGreaterThan(0)

      await space.public.remove('k2')
      expect(await space.public.get('k2')).toBeUndefined()
    })

    it('setMultiple works correctly', async () => {
      await space.public.setMultiple(['k4', 'k5', 'k6'], ['v4', 'v5', 'v6'])
      expect(await space.public.get('k4')).toEqual('v4')
      expect(await space.public.get('k5')).toEqual('v5')
      expect(await space.public.get('k6')).toEqual('v6')
      await space.public.remove('k6')
      expect(await space.public.get('k6')).toBeUndefined()

      expect(space.public.setMultiple(['key'], ['value', 'value1'])).rejects.toEqual(new Error('Arrays must be of the same length'))
      expect(space.public.setMultiple('key', ['value', 'value1'])).rejects.toEqual(new Error('One or more arguments are not an array'))
    })

    it('log should only return public values', async () => {
      const log1 = await space.public.log()
      expect(log1).toMatchSnapshot()
      space._store.set('key', 'value')
      const log2 = await space.public.log()
      expect(log2).toEqual(log1)
    })

    it('all should return all values from public store', async () => {
      expect(await space.public.all()).toMatchSnapshot()
      expect(await space.public.all({ metadata: true })).toMatchSnapshot()
    })

    it('should throw if key not given', async () => {
      expect(space.public.set()).rejects.toEqual(new Error('key is a required argument'))
      expect(space.public.remove()).rejects.toEqual(new Error('key is a required argument'))
    })
  })

  describe('private store reducer', () => {
    it('get/set/remove works correctly', async () => {
      await space.private.set('k1', 'sv1')
      await space.private.set('k2', 'sv2')
      await space.private.set('k3', 'sv3')
      expect(await space.private.get('k1')).toEqual('sv1')
      expect(await space.private.get('k2')).toEqual('sv2')
      const entry = await space.private.get('k3', { metadata: true })
      expect(entry.value).toEqual('sv3')
      expect(entry.timestamp).toBeGreaterThan(0)

      await space.private.remove('k2')
      expect(await space.private.get('k2')).toEqual(null)
    })

    it('setMultiple works correctly', async () => {
      await space.private.setMultiple(['k4', 'k5', 'k6'], ['sv4', 'sv5', 'sv6'])
      expect(await space.private.get('k4')).toEqual('sv4')
      expect(await space.private.get('k5')).toEqual('sv5')
      expect(await space.private.get('k6')).toEqual('sv6')
      await space.private.remove('k6')
      expect(await space.private.get('k6')).toEqual(null)

      expect(space.private.setMultiple(['key'], ['value', 'value1'])).rejects.toEqual(new Error('Arrays must be of the same length'))
      expect(space.private.setMultiple('key', ['value', 'value1'])).rejects.toEqual(new Error('One or more arguments are not an array'))
    })

    it('log should only return private values', async () => {
      const refLog = [{ key: 'k1', op: 'PUT', timeStamp: 123, value: 'sv1' }, { key: 'k3', op: 'PUT', timeStamp: 123, value: 'sv3' }, { key: 'k4', op: 'PUT', timeStamp: 123, value: 'sv4' }, { key: 'k5', op: 'PUT', timeStamp: 123, value: 'sv5' } ]
      const log1 = await space.private.log()
      expect(log1).toEqual(refLog)
      space._store.set('key', 'value')
      const log2 = await space.private.log()
      expect(log2).toEqual(log1)
    })

    it('all should return all values from private store', async () => {
      const expected = {
        k1: 'sv1',
        k3: 'sv3',
        k4: 'sv4',
        k5: 'sv5'
      }

      expect(await space.private.all()).toEqual(expected)

      const result = await space.private.all({ metadata: true })
      Object.entries(expected).map(([k,v]) => {
        expect(result[k].value).toEqual(v)
        expect(result[k].timestamp).toBeGreaterThan(0)
      })
    })

    it('should throw if key not given', async () => {
      expect(space.private.set()).rejects.toEqual(new Error('key is a required argument'))
      expect(space.private.remove()).rejects.toEqual(new Error('key is a required argument'))
    })
  })

  describe('Threads', () => {
    beforeEach(() => {
      Thread.mockClear()
    })

    const threadAddress = '/orbitdb/zdpuAmUTuZVp5QNw75E9KVaQwfPSM611FCPR2RmMGF6jxWzxW/3box.thread.a.z'
    const threadAddress2 = '/orbitdb/zdpuAu3nxzphjPVgP3sw4HufdG3uvZTerUgS6rQQtk29UAhbd/3box.thread.a.a'

    it('does not subscribe or return invalid thread address (ignore experimental)', async () => {
      await expect(space.subscribeThread('t1')).rejects.toThrowErrorMatchingSnapshot()
      // experimental threads
      await space.public.set('thread-t1')
      expect(await space.subscribedThreads()).toEqual([])
    })

    it('subscribes to thread correctly', async () => {
      await space.subscribeThread(threadAddress)
      expect(await space.public.get(`thread-${threadAddress}`)).toEqual({ address: threadAddress })
      expect(await space.subscribedThreads()).toEqual([{address: threadAddress}])
    })

    it('unsubscribes from thread correctly', async () => {
      await space.unsubscribeThread(threadAddress)
      expect(await space.public.get(`thread-${threadAddress}`)).toEqual()
      expect(await space.subscribedThreads()).toEqual([])
    })

    it('joins thread correctly', async () => {
      const t1 = await space.joinThread('t2')
      expect(Thread).toHaveBeenCalledTimes(1)
      expect(Thread.mock.calls[0][0]).toEqual(`3box.thread.${NAME1}.t2`)
      expect(Thread.mock.calls[0][1]).toEqual(replicatorMock)
      expect(t1._load).toHaveBeenCalledTimes(1)
      expect(t1._setIdentity).toHaveBeenCalledTimes(1)
      expect(t1._setIdentity).toHaveBeenCalledWith('odbid')
      // function for autosubscribing works as intended
      await Thread.mock.calls[0][4](threadAddress)
      expect(await space.subscribedThreads()).toEqual([{address: threadAddress}])
    })

    it('a thread loaded by address, must be in same space as threadname, otherwise throws', async () => {
      const threadAddress = "/orbitdb/zdpuAz8c2gjonfuhYCfPJqZJUfYM5Kd7bpHaMyJZSLDMHSNvQ/3box.thread.errorspace.test"
      await expect(space.joinThreadByAddress(threadAddress)).rejects.toThrow(/must open within same space/)
    })

    it('joins thread correctly, no auto subscription', async () => {
      const t1 = await space.joinThread('t3', { noAutoSub: true })
      expect(Thread).toHaveBeenCalledTimes(1)
      expect(Thread.mock.calls[0][0]).toEqual(`3box.thread.${NAME1}.t3`)
      expect(Thread.mock.calls[0][1]).toEqual(replicatorMock)
      expect(t1._load).toHaveBeenCalledTimes(1)
      expect(t1._setIdentity).toHaveBeenCalledTimes(1)
      expect(t1._setIdentity).toHaveBeenCalledWith('odbid')
      // function for autosubscribing works as intended
      await Thread.mock.calls[0][4](threadAddress2)
      expect(await space.subscribedThreads()).toEqual([{address: threadAddress}])
    })

    it('should trow if space not open and no firstModerator', async () => {
      const sp = new Space(NAME2, replicatorMock)
      const t1 = await
      expect(sp.joinThread('t1')).rejects.toMatchSnapshot()
    })

    it('joins thread correctly with space that is not open', async () => {
      const sp = new Space(NAME2, replicatorMock)
      const firstModerator = 'did:3:bafyasdf'
      const t1 = await sp.joinThread('t1', { firstModerator })
      expect(Thread).toHaveBeenCalledTimes(1)
      expect(Thread.mock.calls[0][0]).toEqual(`3box.thread.${NAME2}.t1`)
      expect(Thread.mock.calls[0][1]).toEqual(replicatorMock)
      expect(Thread.mock.calls[0][3]).toEqual(firstModerator)
      expect(t1._load).toHaveBeenCalledTimes(1)
      expect(t1._setIdentity).toHaveBeenCalledTimes(0)
      // function for autosubscribing works as intended
      await Thread.mock.calls[0][4](threadAddress)
    })
  })
})
