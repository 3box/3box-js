const testUtils = require('./testUtils')
const Pubsub = require('orbit-db-pubsub')
const jsdom = require('jsdom')
global.window = new jsdom.JSDOM().window

const Verifications = require('../verifications')
const Box = require('../3box')

const MOCK_HASH_SERVER = 'address-server'
const boxOpts = {
  ipfsOptions: {
    EXPERIMENTAL: {
      pubsub: true
    },
    repo: './tmp/ipfs1/'
  },
  orbitPath: './tmp/orbitdb1',
  addressServer: MOCK_HASH_SERVER
}

describe('Verifications', () => {
  // let publicStore
  // const linkProfile = jest.fn()
  let box
  let ipfs
  let pubsub
  jest.setTimeout(30000)

  beforeAll(async () => {
    // publicStore = new PublicStore('orbitdb instance', STORE_NAME, linkProfile)

    ipfs = await testUtils.initIPFS(true)
    const ipfsMultiAddr = (await ipfs.id()).addresses[0]
    boxOpts.pinningNode = ipfsMultiAddr
    pubsub = new Pubsub(ipfs, (await ipfs.id()).id)
 
    const publishPromise = new Promise((resolve, reject) => {
      pubsub.subscribe('3box-pinning', (topic, data) => {
        expect(data.odbAddress).toEqual('/orbitdb/QmdmiLpbTca1bbYaTHkfdomVNUNK4Yvn4U1nTCYfJwy6Pn/b932fe7ab.root')
        resolve()
      }, () => {})
    })
    const addr = '0x12345'
    const prov = 'web3prov'
    const consentCallback = jest.fn()
    const opts = { ...boxOpts, consentCallback }
    box = await Box.openBox(addr, prov, opts)
    
    await publishPromise

  })

  it('should throw if gistUrl does not contain the correct did', async () => {
    // expect(publicStore.all('key', 'value')).rejects.toThrow(/_load must/)
    console.log("ok");
  })


  it('should add the github proof and get the github handler to verify if it is verified', async () => {
    // expect(publicStore.all('key', 'value')).rejects.toThrow(/_load must/)
    console.log("ok");
  })

  // it('should call linkProfile when set is called', async () => {
  //   await publicStore._load()
  //   let ret = await publicStore.set('key1', 'value1')
  //   expect(ret).toEqual(true)
  //   expect(linkProfile).toHaveBeenCalledTimes(1)
  //   expect(linkProfile).toHaveBeenCalledWith()
  // })

  // it('should return profile correctly', async () => {
  //   expect(await publicStore.all()).toEqual({ key1: 'value1' })
  // })
})
