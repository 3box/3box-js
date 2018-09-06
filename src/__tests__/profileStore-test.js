const IPFSFactory = require('ipfsd-ctl')
const ProfileStore = require('../profileStore')


describe('ProfileStore', () => {

  let ipfsd
  let profileStore

  updateRoot = () => {}
  linkProfile = () => {}

  beforeAll(async () => {
    ipfsd = await spawnIPFSD()
    profileStore = new ProfileStore(ipfsd.api, updateRoot, linkProfile)
  })

  it('', async () => {
  })

  afterAll(() => {
    ipfsd.stop()
  })
})

function spawnIPFSD () {
  return new Promise((resolve, reject) => {
    const f = IPFSFactory.create({type: 'proc', exec: require('ipfs')})
    f.spawn(function (err, ipfsd) {
      if (err) reject(err)
      resolve(ipfsd)
    })
  })
}


