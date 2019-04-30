const PublicStore = require('../publicStore')

const STORE_NAME = '09ab7cd93f9e.public'
const emptyEnsureConn = () => {}

jest.mock('../keyValueStore')

describe('PublicStore', () => {
  let publicStore
  const linkProfile = jest.fn()

  beforeAll(async () => {
    publicStore = new PublicStore('orbitdb instance', STORE_NAME, linkProfile, emptyEnsureConn)
  })

  it('should throw if not synced', async () => {
    expect(publicStore.all('key', 'value')).rejects.toThrow(/_load must/)
  })

  it('should call linkProfile when set is called', async () => {
    await publicStore._load()
    let ret = await publicStore.set('key1', 'value1')
    expect(ret).toEqual(true)
    expect(linkProfile).toHaveBeenCalledTimes(1)
    expect(linkProfile).toHaveBeenCalledWith()
  })

  it('should not call linkProfile when noLink is true', async () => {
    linkProfile.mockClear()
    await publicStore._load()
    let ret = await publicStore.set('key1', 'value1', { noLink: true })
    expect(ret).toEqual(true)
    expect(linkProfile).toHaveBeenCalledTimes(0)
  })

  it('should throw if key not given', async () => {
    expect(publicStore.set()).rejects.toEqual(new Error('key is a required argument'))
  })

  it('should return profile correctly', async () => {
    expect(await publicStore.all()).toEqual({ key1: 'value1' })
  })
})
