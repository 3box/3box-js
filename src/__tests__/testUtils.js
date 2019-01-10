const IPFS = require('ipfs')

const CONF_1 = {
  EXPERIMENTAL: {
    pubsub: true
  },
  repo: './tmp/ipfs4/',
  config: {
    Addresses: {
      Swarm: [
        '/ip4/127.0.0.1/tcp/4006',
        '/ip4/127.0.0.1/tcp/4007/ws'
      ],
      API: '/ip4/127.0.0.1/tcp/5004',
      Gateway: '/ip4/127.0.0.1/tcp/9092'
    },
    Bootstrap: []
  }
}

const CONF_2 = {
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
    },
    Bootstrap: []
  }
}

const CONF_3 = {
  EXPERIMENTAL: {
    pubsub: true
  },
  repo: './tmp/ipfs5/',
  config: {
    Addresses: {
      Swarm: [
        '/ip4/127.0.0.1/tcp/4008',
        '/ip4/127.0.0.1/tcp/4009/ws'
      ],
      API: '/ip4/127.0.0.1/tcp/5010',
      Gateway: '/ip4/127.0.0.1/tcp/9093'
    },
    Bootstrap: []
  }
}

const CONF_4 = {
  EXPERIMENTAL: {
    pubsub: true
  },
  repo: './tmp/ipfs6/',
  config: {
    Addresses: {
      Swarm: [
        '/ip4/127.0.0.1/tcp/4011',
        '/ip4/127.0.0.1/tcp/4012/ws'
      ],
      API: '/ip4/127.0.0.1/tcp/5013',
      Gateway: '/ip4/127.0.0.1/tcp/9094'
    },
    Bootstrap: []
  }
}
const CONFS = [CONF_1, CONF_2, CONF_3, CONF_4]

module.exports = {
  initIPFS: async (useAltConf) => {
    console.log('num', useAltConf, CONFS[useAltConf])
    return new Promise((resolve, reject) => {
      let ipfs = new IPFS(CONFS[useAltConf])
      ipfs.on('error', reject)
      ipfs.on('ready', () => resolve(ipfs))
    })
  }
}
