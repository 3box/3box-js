const path = require('path');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
  entry: './src/3box.js',
  output: {
    filename: '3box.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'ThreeBox',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  optimization: {
   minimizer: [
     new UglifyJsPlugin()
   ]
 },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: [
              ['@babel/plugin-transform-runtime', {
                'regenerator': true
              }],
              ['@babel/plugin-proposal-object-rest-spread']
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
