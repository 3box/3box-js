const utils = require('./testUtils')
const PublicStore = require('../publicStore')

const STORE_NAME = '09ab7cd93f9e.public'

jest.mock('../keyValueStore')

describe('PublicStore', () => {
  let publicStore
  const linkProfile = jest.fn()

  beforeAll(async () => {
    publicStore = new PublicStore('orbitdb instance', STORE_NAME, linkProfile)
  })

  it('should throw if not synced', async () => {
    expect(publicStore.all('key', 'value')).rejects.toThrow(/_sync must/)
  })

  it('should call linkProfile when set is called', async () => {
    await publicStore._sync()
    let ret = await publicStore.set('key1', 'value1')
    expect(ret).toEqual(true)
    expect(linkProfile).toHaveBeenCalledTimes(1)
    expect(linkProfile).toHaveBeenCalledWith()
  })

  it('should return profile correctly', async () => {
    expect(await publicStore.all()).toEqual({ key1: 'value1' })
  })
})
