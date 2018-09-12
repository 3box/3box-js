const IPFSFactory = require('ipfsd-ctl')

module.exports = {
  spawnIPFSD: () => {
    return new Promise((resolve, reject) => {
      IPFSFactory.create({ type: 'proc', exec: require('ipfs') })
        .spawn(function (err, ipfsd) {
          if (err) reject(err)
          resolve(ipfsd)
        })
    })
  }
}
