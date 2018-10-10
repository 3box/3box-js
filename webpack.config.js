const path = require('path');

module.exports = {
  entry: './src/3box.js',
  output: {
    filename: '3box.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'ThreeBox',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['env'],
            "plugins": [
   ["transform-runtime", {
     "polyfill": false,
     "regenerator": true
   }]
 ]
          }
        }
      }
    ]
  },
  node: {
    console: false,
    fs: 'empty',
    net: 'empty',
    tls: 'empty',
    child_process: 'empty'
  }
};
