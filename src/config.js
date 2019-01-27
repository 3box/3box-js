const IFRAME_STORE_VERSION = '0.0.3'

module.exports = {
  address_server_url: process.env.ADDRESS_SERVER_URL || 'https://beta.3box.io/address-server',
  pinning_node: process.env.PINNING_NODE || '/dnsaddr/ipfs.3box.io/tcp/443/wss/ipfs/QmZvxEpiVNjmNbEKyQGvFzAY1BwmGuuvdUTmcTstQPhyVC',
  pinning_room: process.env.PINNING_ROOM || '3box-pinning',
  iframe_store_version: process.env.IFRAME_STORE_VERSION || IFRAME_STORE_VERSION,
  iframe_store_url: process.env.IFRAME_STORE_URL || `https://iframe.3box.io/${IFRAME_STORE_VERSION}/iframe.html`,
  ipfs_options: {
    EXPERIMENTAL: {
      pubsub: true
    },
    preload: { enabled: false },
    config: {
      Bootstrap: [ ]
    }
  },
  graphql_server_url: process.env.GRAPHQL_SERVER_URL || 'https://aic67onptg.execute-api.us-west-2.amazonaws.com/develop/graphql',
  profile_server_url: process.env.PROFILE_SERVER_URL || 'https://ipfs.3box.io'
}
