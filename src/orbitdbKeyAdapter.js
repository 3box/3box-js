const EC = require('elliptic').ec
const ec = new EC('secp256k1')

class OrbitdbKeyStore {
  constructor(muport) {
    this._muport = muport
  }

  createKey() {
    return this.getKey()
  }

  getKey() {
    return ec.keyFromPrivate(this._muport.keyring.signingKey._hdkey._privateKey)
  }

  generateKey() {
    return Promise.resolve(ec.genKeyPair())
  }

  exportPublicKey(key) {
    return Promise.resolve(key.getPublic('hex'))
  }

  exportPrivateKey(key) {
    return Promise.resolve(key.getPrivate('hex'))
  }

  importPublicKey(key) {
    return Promise.resolve(ec.keyFromPublic(key, 'hex'))
  }

  importPrivateKey(key) {
    return Promise.resolve(ec.keyFromPrivate(key, 'hex'))
  }

  sign(key, data) {
    const sig = ec.sign(data, key)
    return Promise.resolve(sig.toDER('hex'))
  }

  verify(signature, key, data) {
    let res = false
    res = ec.verify(data, signature, key)
    return Promise.resolve(res)
  }
}

module.exports = OrbitdbKeyStore
