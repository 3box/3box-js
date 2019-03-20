const fetch = typeof window !== 'undefined' ? window.fetch : require('node-fetch')
const Multihash = require('multihashes')
const sha256 = require('js-sha256').sha256

module.exports = {
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
    const text = 'Create a new 3Box profile' + '\n\n' + '- \n' + 'Your unique profile ID is ' + toDID
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
          const out = {
            msg: text,
            sig: result.result
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
      throw new Error(`Invalid response (${r.status}) for query at ${url}`)
    }
  },

  fetchText: async (url, opts) => {
    const r = await fetch(url, opts)

    if (r.ok) {
      return r.text()
    } else {
      throw new Error(`Invalid response (${r.status}) for query at ${url}`)
    }
  },

  sha256Multihash: str => {
    const digest = Buffer.from(sha256.digest(str))
    return Multihash.encode(digest, 'sha2-256').toString('hex')
  },
  sha256
}
