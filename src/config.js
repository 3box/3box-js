const IFRAME_STORE_VERSION = '0.0.3'

module.exports =  {
  address_server_url: 'https://beta.3box.io/address-server',
  pinning_node: '/dnsaddr/ipfs.3box.io/tcp/443/wss/ipfs/QmZvxEpiVNjmNbEKyQGvFzAY1BwmGuuvdUTmcTstQPhyVC',
  pinning_room: '3box-pinning',
  iframe_store_version: IFRAME_STORE_VERSION,
  iframe_store_url: `https://iframe.3box.io/${IFRAME_STORE_VERSION}/iframe.html`,
  ipfs_options: {
    EXPERIMENTAL: {
      pubsub: true
    },
    preload: { enabled: false },
    config: {
      Bootstrap: [ ]
    }
  },
  graphql_server_url: 'https://aic67onptg.execute-api.us-west-2.amazonaws.com/develop/graphql',
  profile_server_url: 'https://ipfs.3box.io'
}
