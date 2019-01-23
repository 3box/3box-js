jest.mock('../keyValueStore')
const ENSURE_CONNECTED = 'ensure connected function'
const ORBITDB = 'orbitdb instance'
const threeIdMock = {
  initKeyringByName: () => {
    return false
  }
}
let rootstoreMockData = []
const rootstoreMock = {
  iterator: () => { return { collect: () => rootstoreMockData } },
  add: jest.fn()
}

const Space = require('../space')


describe('Space', () => {

  let space
  let NAME1 = 'test1'
  let NAME2 = 'test2'

  beforeEach(() => {
    rootstoreMock.add.mockClear()
  })

  it('should be correctly constructed', async () => {
    space = new Space(NAME1, threeIdMock, ORBITDB, rootstoreMock, ENSURE_CONNECTED)
    expect(space._name).toEqual(NAME1)
    expect(space._3id).toEqual(threeIdMock)
    expect(space._rootStore).toEqual(rootstoreMock)
    expect(space._store._orbitdb).toEqual(ORBITDB)
    expect(space._store._ensureConnected).toEqual(ENSURE_CONNECTED)
    expect(space._store._name).toEqual('3box.space.' + NAME1)
  })

  it('should open a new space correctly', async () => {
    let opts = {
      consentCallback: jest.fn(),
    }
    const syncDonePromise = new Promise((resolve, reject) => {
      opts.onSyncDone = resolve
    })
    await space.open(opts)
    expect(opts.consentCallback).toHaveBeenCalledWith(false, NAME1)
    expect(rootstoreMock.add).toHaveBeenCalledWith({ odbAddress:'/orbitdb/myodbaddr' })
    await syncDonePromise
  })

  it('should return directly if space already opened', async () => {
    let opts = {
      consentCallback: jest.fn(),
    }
    await space.open(opts)
    expect(opts.consentCallback).toHaveBeenCalledTimes(0)
  })

  it('should open correctly and not add to rootStore if entry already present', async () => {
    rootstoreMockData.push({ payload: { value: { odbAddress: '/orbitdb/Qmasofgh/3box.space.' + NAME2 } } })
    let opts = {
      consentCallback: jest.fn(),
    }
    const syncDonePromise = new Promise((resolve, reject) => {
      opts.onSyncDone = resolve
    })
    space = new Space(NAME2, threeIdMock, ORBITDB, rootstoreMock, ENSURE_CONNECTED)
    await space.open(opts)
    expect(opts.consentCallback).toHaveBeenCalledWith(false, NAME2)
    expect(rootstoreMock.add).toHaveBeenCalledTimes(0)
    await syncDonePromise
  })
})
