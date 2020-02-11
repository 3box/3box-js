const nacl = require('tweetnacl')
nacl.util = require('tweetnacl-util')

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

const newSymKey = () => {
  return nacl.randomBytes(32)
}


module.exports = { randomNonce, symEncryptBase, symDecryptBase, newSymKey }
