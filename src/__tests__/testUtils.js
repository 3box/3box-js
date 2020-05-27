const IPFS = require('ipfs')
const fs = require('fs')

const genConf = id => {
  return {
    repo: `./tmp/ipfs${id}/`,
    config: {
      Addresses: {
        Swarm: [
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
    return IPFS.create(genConf(useAltConf))
  },
  delay: millisecs => new Promise((resolve, reject) => { setTimeout(resolve, millisecs) })
}
