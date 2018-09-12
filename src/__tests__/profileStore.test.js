const utils = require('./testUtils')
const ProfileStore = require('../profileStore')

describe('ProfileStore', () => {
  let ipfsd
  let profileStore

  let latestRoot = null
  const updateRoot = newRoot => {
    expect(newRoot).not.toEqual(latestRoot)
    latestRoot = newRoot
  }

  beforeAll(async () => {
    ipfsd = await utils.spawnIPFSD()
    profileStore = new ProfileStore(ipfsd.api, updateRoot)
  })

  it('should throw if not synced', async () => {
    expect(profileStore.set('key', 'value')).rejects.toThrow(/_sync must/)
    expect(profileStore.get('key')).rejects.toThrow(/no public profile yet/)
    expect(profileStore.remove('key')).rejects.toThrow(/_sync must/)
  })

  it('should start with an empty profile on first sync', async () => {
    await profileStore._sync()
    expect(profileStore.profile).toEqual({})
  })

  it('should set and get values correctly', async () => {
    await profileStore.set('key1', 'value1')
    expect(await profileStore.get('key1')).toEqual('value1')

    await profileStore.set('key2', 'lalalla')
    expect(await profileStore.get('key2')).toEqual('lalalla')

    await profileStore.set('key3', '12345')
    expect(await profileStore.get('key3')).toEqual('12345')
  })


  it('should remove values correctly', async () => {
    await profileStore.remove('key3')
    expect(await profileStore.get('key3')).toBeUndefined()
    await profileStore.remove('key2')
    expect(await profileStore.get('key2')).toBeUndefined()
  })

  it('should sync an old profile correctly', async () => {
    let profileStore2 = new ProfileStore(ipfsd.api, updateRoot)
    await profileStore2._sync(latestRoot)

    expect(await profileStore2.get('key1')).toEqual('value1')
    expect(await profileStore2.get('key2')).toBeUndefined()
    expect(await profileStore2.get('key3')).toBeUndefined()
  })

  afterAll(async done => {
    ipfsd.stop(done)
  })
})
