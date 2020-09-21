const fetch = typeof window !== 'undefined' ? window.fetch : require('node-fetch')
const Multihash = require('multihashes')
const sha256 = require('js-sha256').sha256
import { verifyMessage } from '@ethersproject/wallet'

const ENC_BLOCK_SIZE = 24
const MAGIC_ERC1271_VALUE = '0x20c13b0b'

const pad = (val, blockSize = ENC_BLOCK_SIZE) => {
  const blockDiff = (blockSize - (val.length % blockSize)) % blockSize
  return `${val}${'\0'.repeat(blockDiff)}`
}

const unpad = padded => padded.replace(/\0+$/, '')

const HTTPError = (status, message) => {
  const e = new Error(message)
  e.statusCode = status
  return e
}

const getMessageConsent = (did, timestamp) => {
  let msg = 'Create a new 3Box profile' + '\n\n' + '- \n' + 'Your unique profile ID is ' + did
  if (timestamp) msg += ' \n' + 'Timestamp: ' + timestamp
  return msg
}

const safeSend = (provider, data) => {
  const send = (Boolean(provider.sendAsync) ? provider.sendAsync : provider.send).bind(provider)
  return new Promise((resolve, reject) => {
    send(data, function(err, result) {
      if (err) reject(err)
      else if (result.error) reject(result.error)
      else resolve(result.result)
    })
  })
}

const encodeRpcCall = (method, params, fromAddress) => ({
  jsonrpc: '2.0',
  id: 1,
  method,
  params,
  fromAddress
})

const callRpc = async (provider, method, params, fromAddress) => safeSend(provider, encodeRpcCall(method, params, fromAddress))

module.exports = {
  getMessageConsent,
  callRpc,

  openBoxConsent: async (fromAddress, ethereum) => {
    const text = 'This app wants to view and update your 3Box profile.'
    if (ethereum.isAuthereum) return ethereum.signMessageWithSigningKey(text)
    var msg = '0x' + Buffer.from(text, 'utf8').toString('hex')
    var params = [msg, fromAddress]
    var method = 'personal_sign'
    const res = await callRpc(ethereum, method, params, fromAddress)

    if (fromAddress) {
      const recoveredAddr = verifyMessage(text, res).toLowerCase()
      if (fromAddress !== recoveredAddr) throw new Error('Provider returned signature from different account than requested')
    }

    return res
  },

  openSpaceConsent: async (fromAddress, ethereum, name) => {
    const text = `Allow this app to open your ${name} space.`
    if (ethereum.isAuthereum) return ethereum.signMessageWithSigningKey(text)
    var msg = '0x' + Buffer.from(text, 'utf8').toString('hex')
    var params = [msg, fromAddress]
    var method = 'personal_sign'
    const res = await callRpc(ethereum, method, params, fromAddress)

    if (fromAddress) {
      const recoveredAddr = verifyMessage(text, res).toLowerCase()
      if (fromAddress !== recoveredAddr) throw new Error('Provider returned signature from different account than requested')
    }

    return res
  },

  fetchJson: async (url, body) => {
    let opts
    if (body) {
      opts = { body: JSON.stringify(body), method: 'POST', headers: { 'Content-Type': 'application/json' } }
    }
    const r = await fetch(url, opts)

    if (r.ok) {
      return r.json()
    } else {
      throw HTTPError(r.status, (await r.json()).message)
    }
  },

  fetchText: async (url, opts) => {
    const r = await fetch(url, opts)

    if (r.ok) {
      return r.text()
    } else {
      throw HTTPError(r.status, `Invalid response (${r.status}) for query at ${url}`)
    }
  },

  throwIfUndefined: (arg, name) => {
    if (arg === undefined || arg === null) {
      throw new Error(`${name} is a required argument`)
    }
  },

  throwIfNotEqualLenArrays: (arr1, arr2) => {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
      throw new Error('One or more arguments are not an array')
    }

    if (arr1.length !== arr2.length) {
      throw new Error('Arrays must be of the same length')
    }
  },

  getPeerIdFromMultiaddr: (multiaddr) => {
    return multiaddr.substring(multiaddr.lastIndexOf('/') + 1)
  },

  sha256Multihash: str => {
    const digest = Buffer.from(sha256.digest(str))
    return Buffer.from(Multihash.encode(digest, 'sha2-256')).toString('hex')
  },
  randInt: max => Math.floor(Math.random() * max),
  sha256,
  pad,
  unpad
}
