const path = require('path');

module.exports = Object.assign(require('./webpack.config.js'), {
  entry: './src/api.js',
  output: {
    filename: '3box.api.min.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'BoxAPI',
    libraryTarget: 'umd',
    umdNamedDefine: true
  }
})
