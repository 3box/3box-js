const IPFS = require('ipfs')
const fs = require('fs')

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

const CONF_5 = {
  EXPERIMENTAL: {
    pubsub: true
  },
  repo: './tmp/ipfs7/',
  config: {
    Addresses: {
      Swarm: [
        '/ip4/127.0.0.1/tcp/4014',
        '/ip4/127.0.0.1/tcp/4015/ws'
      ],
      API: '/ip4/127.0.0.1/tcp/5016',
      Gateway: '/ip4/127.0.0.1/tcp/9095'
    },
    Bootstrap: []
  }
}

const CONF_6 = {
  EXPERIMENTAL: {
    pubsub: true
  },
  repo: './tmp/ipfs8/',
  config: {
    Addresses: {
      Swarm: [
        '/ip4/127.0.0.1/tcp/4017',
        '/ip4/127.0.0.1/tcp/4018/ws'
      ],
      API: '/ip4/127.0.0.1/tcp/5019',
      Gateway: '/ip4/127.0.0.1/tcp/9096'
    },
    Bootstrap: []
  }
}

const CONF_7 = {
  EXPERIMENTAL: {
    pubsub: true
  },
  repo: './tmp/ipfs9/',
  config: {
    Addresses: {
      Swarm: [
        '/ip4/127.0.0.1/tcp/4019',
        '/ip4/127.0.0.1/tcp/4020/ws'
      ],
      API: '/ip4/127.0.0.1/tcp/5020',
      Gateway: '/ip4/127.0.0.1/tcp/9097'
    },
    Bootstrap: []
  }
}
const CONFS = [CONF_1, CONF_2, CONF_3, CONF_4, CONF_5, CONF_6, CONF_7]

module.exports = {
  initIPFS: async (useAltConf) => {
    return new Promise((resolve, reject) => {
      let ipfs = new IPFS(CONFS[useAltConf])
      ipfs.on('error', reject)
      ipfs.on('ready', () => resolve(ipfs))
    })
  },
  stopIPFS: async (ipfs, useAltConf) => {
    // seems to be an issue with the api file not being present when trying to close ipfs
    const apiFilePath = CONFS[useAltConf].repo + 'api'
    fs.closeSync(fs.openSync(apiFilePath, 'w'))
    await ipfs.stop()
  }
}
