const IPFS = require('ipfs')

const CONF = {
  EXPERIMENTAL: {
    pubsub: true
  },
  repo: './tmp/ipfs1/'
}
const ALT_CONF = {
  EXPERIMENTAL: {
    pubsub: true
  },
  repo: './tmp/ipfs2/',
  config: {
    Addresses: {
      Swarm: [
        '/ip4/127.0.0.1/tcp/4004',
        '/ip4/127.0.0.1/tcp/4005/ws'
      ],
      API: '/ip4/127.0.0.1/tcp/5003',
      Gateway: '/ip4/127.0.0.1/tcp/9091'
    }
  }
}

module.exports = {
  initIPFS: async (useAltConf) => {
    return new Promise((resolve, reject) => {
      let ipfs = new IPFS(useAltConf ? ALT_CONF : CONF)
      ipfs.on('error', reject)
      ipfs.on('ready', () => resolve(ipfs))
    })
  }
}
