const { HDNode } = require('ethers').utils
const nacl = require('tweetnacl')
nacl.util = require('tweetnacl-util')
const SimpleSigner = require('did-jwt').SimpleSigner
const { sha256 } = require('../utils/index')

const BASE_PATH = "m/7696500'/0'/0'"
const MM_PATH = "m/44'/60'/0'/0"

class Keyring {
  constructor (seed) {
    this._seed = seed
    const seedNode = HDNode.fromSeed(this._seed)
    const baseNode = seedNode.derivePath(BASE_PATH)

    this.signingKey = baseNode.derivePath("0")
    const tmpEncKey = Buffer.from(baseNode.derivePath("2").privateKey.slice(2), 'hex')
    this.asymEncryptionKey = nacl.box.keyPair.fromSecretKey(new Uint8Array(tmpEncKey))
    this.symEncryptionKey = new Uint8Array(Buffer.from(baseNode.derivePath("3").privateKey.slice(2), 'hex'))

    this.ethereumKey = seedNode.derivePath(MM_PATH).derivePath("0")
  }

  asymEncrypt (msg, toPublic, nonce) {
    nonce = nonce || randomNonce()
    toPublic = nacl.util.decodeBase64(toPublic)
    if (typeof msg === 'string') {
      msg = nacl.util.decodeUTF8(msg)
    }
    const ciphertext = nacl.box(msg, nonce, toPublic, this.asymEncryptionKey.secretKey)
    return {
      nonce: nacl.util.encodeBase64(nonce),
      ciphertext: nacl.util.encodeBase64(ciphertext)
    }
  }

  asymDecrypt (ciphertext, fromPublic, nonce, toBuffer) {
    fromPublic = nacl.util.decodeBase64(fromPublic)
    ciphertext = nacl.util.decodeBase64(ciphertext)
    nonce = nacl.util.decodeBase64(nonce)
    const cleartext = nacl.box.open(ciphertext, nonce, fromPublic, this.asymEncryptionKey.secretKey)
    if (toBuffer) {
      return cleartext ? Buffer.from(cleartext) : null
    }
    return cleartext ? nacl.util.encodeUTF8(cleartext) : null
  }

  symEncrypt (msg, nonce) {
    return symEncryptBase(msg, this.symEncryptionKey, nonce)
  }

  symDecrypt (ciphertext, nonce, toBuffer) {
    return symDecryptBase(ciphertext, this.symEncryptionKey, nonce, toBuffer)
  }

  getJWTSigner () {
    return SimpleSigner(this.signingKey.privateKey.slice(2))
  }

  getDBKey () {
    return this.signingKey.privateKey.slice(2)
  }

  getDBSalt () {
    return sha256(this.signingKey.derivePath('0').privateKey.slice(2))
  }

  getPublicKeys (uncompressed) {
    return {
      signingKey: (uncompressed ? this.signingKey.keyPair.publicKey : this.signingKey.publicKey).slice(2),
      ethereumKey: (uncompressed ? this.ethereumKey.keyPair.publicKey : this.ethereumKey.publicKey).slice(2),
      asymEncryptionKey: nacl.util.encodeBase64(this.asymEncryptionKey.publicKey)
    }
  }

  serialize () {
    return this._seed
  }
}

const randomNonce = () => {
  return nacl.randomBytes(24)
}

const symEncryptBase = (msg, symKey, nonce) => {
  nonce = nonce || randomNonce()
  if (typeof msg === 'string') {
    msg = nacl.util.decodeUTF8(msg)
  }
  const ciphertext = nacl.secretbox(msg, nonce, symKey)
  return {
    nonce: nacl.util.encodeBase64(nonce),
    ciphertext: nacl.util.encodeBase64(ciphertext)
  }
}

const symDecryptBase = (ciphertext, symKey, nonce, toBuffer) => {
  ciphertext = nacl.util.decodeBase64(ciphertext)
  nonce = nacl.util.decodeBase64(nonce)
  const cleartext = nacl.secretbox.open(ciphertext, nonce, symKey)
  if (toBuffer) {
    return cleartext ? Buffer.from(cleartext) : null
  }
  return cleartext ? nacl.util.encodeUTF8(cleartext) : null
}

module.exports = Keyring
