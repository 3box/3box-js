const IPFS = require('ipfs')
const fs = require('fs')

const genConf = id => {
  return {
    EXPERIMENTAL: {
      pubsub: true
    },
    repo: `./tmp/ipfs${id}/`,
    config: {
      Addresses: {
        Swarm: [
          `/ip4/127.0.0.1/tcp/${4004 + id * 2}`,
          `/ip4/127.0.0.1/tcp/${4005 + id * 2}/ws`
        ],
        API: `/ip4/127.0.0.1/tcp/${5003 + id}`,
        Gateway: `/ip4/127.0.0.1/tcp/${9091 + id}`
      },
      Bootstrap: []
    }
  }
}

module.exports = {
  initIPFS: async (useAltConf) => {
    return new Promise((resolve, reject) => {
      let ipfs = new IPFS(genConf(useAltConf))
      ipfs.on('error', reject)
      ipfs.on('ready', () => resolve(ipfs))
    })
  },
  stopIPFS: async (ipfs, useAltConf) => {
    // seems to be an issue with the api file not being present when trying to close ipfs
    const apiFilePath = genConf(useAltConf).repo + 'api'
    fs.closeSync(fs.openSync(apiFilePath, 'w'))
    await ipfs.stop()
    //return new Promise((resolve, reject) => {
      //ipfs.stop(err => {
        //console.log('e', err)
        //resolve()
      //})
    //})
  },
  delay: millisecs => new Promise((resolve, reject) => { setTimeout(resolve, millisecs) })
}
