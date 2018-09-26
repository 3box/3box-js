const utils = require('./testUtils')
const ProfileStore = require('../profileStore')

const STORE_NAME = '09ab7cd93f9e.public'

jest.mock('../keyValueStore')

describe('ProfileStore', () => {
  let profileStore
  const linkProfile = jest.fn()

  beforeAll(async () => {
    profileStore = new ProfileStore('orbitdb instance', STORE_NAME, linkProfile)
  })

  it('should throw if not synced', async () => {
    expect(profileStore.all('key', 'value')).rejects.toThrow(/_sync must/)
  })

  it('should call linkProfile when set is called', async () => {
    await profileStore._sync()
    let ret = await profileStore.set('key1', 'value1')
    expect(ret).toEqual(true)
    expect(linkProfile).toHaveBeenCalledTimes(1)
    expect(linkProfile).toHaveBeenCalledWith()
  })

  it('should return profile correctly', async () => {
    expect(await profileStore.all()).toEqual({ key1: 'value1' })
  })
})
