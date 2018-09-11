const utils = require('./testUtils')
const ProfileStore = require('../profileStore')

describe('ProfileStore', () => {
  let ipfsd
  let profileStore

  const updateRoot = newRoot => {
    expect(newRoot).not.toEqual(latestRoot)
    latestRoot = newRoot
  }
  const linkProfile = () => {}

  beforeAll(async () => {
    ipfsd = await utils.spawnIPFSD()
    profileStore = new ProfileStore(ipfsd.api, updateRoot, linkProfile)
  })

  it('', async () => {})

  afterAll(() => {
    ipfsd.stop()
  })
})
