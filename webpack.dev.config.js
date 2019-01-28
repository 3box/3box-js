// const path = require('path');
const webpack = require('webpack')

// const webpackBaseConfig = require('webpack.base.config.js')
//
// webpackBaseConfig['plugins'] = [
//   new webpack.EnvironmentPlugin(['PINNING_NODE'])
// ]

module.exports = Object.assign(require('./webpack.config.js'), {
  watch: true,
  plugins: [
    new webpack.EnvironmentPlugin([
      'ADDRESS_SERVER_URL',
      'PINNING_NODE',
      'PINNING_ROOM',
      'IFRAME_STORE_VERSION',
      'IFRAME_STORE_URL',
      'GRAPHQL_SERVER_URL',
      'PROFILE_SERVER_URL',
      'MUPORT_IPFS_HOST',
      'MUPORT_IPFS_PORT',
      'MUPORT_IPFS_PROTOCOL',
    ])
  ]
})
