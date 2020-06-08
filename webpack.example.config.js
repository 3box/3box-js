const path = require('path');

module.exports = Object.assign(require('./webpack.config.js'), {
  entry: './example/index.js',
  output: {
    filename: 'build.js',
    path: path.resolve(__dirname, 'example'),
    libraryTarget: 'umd',
    umdNamedDefine: true
  }
})
