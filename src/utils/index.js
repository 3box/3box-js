const fetch = typeof window !== 'undefined' ? window.fetch : require('node-fetch')
const Multihash = require('multihashes')
const sha256 = require('js-sha256').sha256
const sigUtil = require('eth-sig-util')

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

module.exports = {
  getMessageConsent,

  recoverPersonalSign: (msg, personalSig) => {
    if (!msg || !personalSig) throw new Error('recoverPersonalSign: missing arguments, msg and/or personalSig')
    const msgParams = {
      data: msg,
      sig: personalSig
    }
    return sigUtil.recoverPersonalSignature(msgParams)
  },

  openBoxConsent: (fromAddress, ethereum) => {
    const text = 'This app wants to view and update your 3Box profile.'
    var msg = '0x' + Buffer.from(text, 'utf8').toString('hex')
    var params = [msg, fromAddress]
    var method = 'personal_sign'
    return new Promise((resolve, reject) => {
      ethereum.sendAsync(
        {
          jsonrpc: '2.0',
          id: 0,
          method,
          params,
          fromAddress
        },
        function(err, result) {
          if (err) reject(err)
          if (result.error) reject(result.error)
          resolve(result.result)
        }
      )
    })
  },

  openSpaceConsent: (fromAddress, ethereum, name) => {
    const text = `Allow this app to open your ${name} space.`
    var msg = '0x' + Buffer.from(text, 'utf8').toString('hex')
    var params = [msg, fromAddress]
    var method = 'personal_sign'
    return new Promise((resolve, reject) => {
      ethereum.sendAsync(
        {
          jsonrpc: '2.0',
          id: 0,
          method,
          params,
          fromAddress
        },
        function(err, result) {
          if (err) reject(err)
          if (result.error) reject(result.error)
          resolve(result.result)
        }
      )
    })
  },

  getLinkConsent: (fromAddress, toDID, ethereum) => {
    const timestamp = Math.floor(new Date().getTime() / 1000)
    const text = getMessageConsent(toDID, timestamp)
    const msg = '0x' + Buffer.from(text, 'utf8').toString('hex')
    const params = [msg, fromAddress]
    const method = 'personal_sign'

    return new Promise((resolve, reject) => {
      ethereum.sendAsync(
        {
          jsonrpc: '2.0',
          id: 0,
          method,
          params,
          fromAddress
        },
        function(err, result) {
          if (err) reject(err)
          if (result.error) reject(result.error)
          const out = {
            msg: text,
            sig: result.result,
            timestamp
          }
          resolve(out)
        }
      )
    })
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
      throw HTTPError(r.status, `Invalid response (${r.status}) for query at ${url}`)
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

  sha256Multihash: str => {
    const digest = Buffer.from(sha256.digest(str))
    return Multihash.encode(digest, 'sha2-256').toString('hex')
  },
  sha256
}
