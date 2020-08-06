const Log = require('ipfs-log')

const RENDEZVOUS_DISABLE = !(
  !process.env.RENDEZVOUS_DISABLE ||
  ['0', 'f', 'false', 'no', 'off'].includes(process.env.RENDEZVOUS_DISABLE.toLowerCase())
)

module.exports = {
  address_server_url: process.env.ADDRESS_SERVER_URL || 'https://beta.3box.io/address-server',
  pinning_node: process.env.PINNING_NODE || '/dnsaddr/ipfs.3box.io/tcp/443/wss/ipfs/QmZvxEpiVNjmNbEKyQGvFzAY1BwmGuuvdUTmcTstQPhyVC',
  // pinning_node: process.env.PINNING_NODE || '/dnsaddr/ipfs-dev.3box.io/tcp/443/wss/ipfs/QmZipMZjcYTjnyk4WQuV1HB5XUM98hBy3MpJmPTsVoMvW8',
  pinning_room: process.env.PINNING_ROOM || '3box-pinning',
  rendezvous_address: RENDEZVOUS_DISABLE ? '' : (process.env.RENDEZVOUS_ADDRESS || '/dns4/p2p.3box.io/tcp/9091/wss/p2p-webrtc-star/'),
  iframe_cache_url: process.env.IFRAME_CACHE_URL || 'https://cache.3box.io',
  threeid_connect_url: process.env.THREEID_CONNECT_URL || 'https://connect.3box.io/v1/index.html',
  ipfs_options: {
    preload: { enabled: false },
    config: {
      Bootstrap: [],
      Addresses: { Swarm: [] }
    }
  },
  orbitdb_options: {
    syncLocal: true,
    sortFn: Log.Sorting.SortByEntryHash // this option is required now but will likely not be in the future.
  },
  graphql_server_url: process.env.GRAPHQL_SERVER_URL || 'https://api.3box.io/graph/',
  profile_server_url: process.env.PROFILE_SERVER_URL || 'https://ipfs.3box.io',
  muport_ipfs_host: process.env.MUPORT_IPFS_HOST || 'ipfs.infura.io',
  muport_ipfs_port: process.env.MUPORT_IPFS_PORT || 5001,
  muport_ipfs_protocol: process.env.MUPORT_IPFS_PROTOCOL || 'https'
}
