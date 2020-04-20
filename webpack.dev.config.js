const webpack = require('webpack')

module.exports = Object.assign(require('./webpack.config.js'), {
  watch: true,
  watchOptions: {
    poll: 500,
    ignored: /node_modules/
  },
  devtool: 'eval-source-map',
  plugins: [
    new webpack.EnvironmentPlugin([
      'ADDRESS_SERVER_URL',
      'PINNING_NODE',
      'PINNING_ROOM',
      'RENDEZVOUS_DISABLE',
      'RENDEZVOUS_ADDRESS',
      'IFRAME_STORE_VERSION',
      'IFRAME_STORE_URL',
      'GRAPHQL_SERVER_URL',
      'PROFILE_SERVER_URL',
      'CERAMIC_IPFS_NODE',
    ])
  ]
})
