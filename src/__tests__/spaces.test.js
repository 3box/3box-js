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

const Spaces = require('../spaces')


describe('Spaces', () => {

  let spaces
  let NAME1 = 'test1'
  let NAME2 = 'test2'

  beforeAll(() => {
    spaces = new Spaces(threeIdMock, ORBITDB, rootstoreMock, ENSURE_CONNECTED)
  })

  beforeEach(() => {
    rootstoreMock.add.mockClear()
  })

  it('should be correctly constructed', async () => {
    expect(spaces._3id).toEqual(threeIdMock)
    expect(spaces._orbitdb).toEqual(ORBITDB)
    expect(spaces._rootStore).toEqual(rootstoreMock)
    expect(spaces._ensureConnected).toEqual(ENSURE_CONNECTED)
  })

  it('should not allow name "open" for a space', async () => {
    expect(spaces.open('open')).rejects.toBeDefined()
  })

  it('should open a new space correctly', async () => {
    let opts = {
      consentCallback: jest.fn(),
    }
    const syncDonePromise = new Promise((resolve, reject) => {
      opts.onSyncDone = resolve
    })
    const testSpace = await spaces.open(NAME1, opts)
    expect(opts.consentCallback).toHaveBeenCalledWith(false, NAME1)
    expect(spaces.test1).toEqual(testSpace)
    expect(testSpace._3id).toEqual(threeIdMock)
    expect(testSpace._orbitdb).toEqual(ORBITDB)
    expect(testSpace._name).toEqual('3box.space.' + NAME1)
    expect(testSpace._ensureConnected).toEqual(ENSURE_CONNECTED)
    expect(rootstoreMock.add).toHaveBeenCalledWith({ odbAddress:'/orbitdb/myodbaddr' })
    await syncDonePromise
  })

  it('should not allow with the same name again', async () => {
    expect(spaces.open(NAME1)).rejects.toBeDefined()
  })

  it('should open with a new name correctly and add to rootStore', async () => {
    rootstoreMockData.push({ payload: { value: { odbAddress: '/orbitdb/Qmasofgh/3box.space.' + NAME2 } } })
    let opts = {
      consentCallback: jest.fn(),
    }
    const syncDonePromise = new Promise((resolve, reject) => {
      opts.onSyncDone = resolve
    })
    const testSpace = await spaces.open(NAME2, opts)
    expect(opts.consentCallback).toHaveBeenCalledWith(false, NAME2)
    expect(spaces.test2).toEqual(testSpace)
    expect(testSpace._3id).toEqual(threeIdMock)
    expect(testSpace._orbitdb).toEqual(ORBITDB)
    expect(testSpace._name).toEqual('3box.space.' + NAME2)
    expect(testSpace._ensureConnected).toEqual(ENSURE_CONNECTED)
    expect(rootstoreMock.add).toHaveBeenCalledTimes(0)
    await syncDonePromise
  })
})
