const XMLHttpRequest = (typeof window !== 'undefined') ? window.XMLHttpRequest : require('xmlhttprequest').XMLHttpRequest
const Multihash = require('multihashes')
const sha256 = require('js-sha256').sha256

module.exports = {
  openBoxConsent: (fromAddress, ethereum) => {
    const text = 'This app wants to view and update your 3Box profile.'
    var msg = '0x' + Buffer.from(text, 'utf8').toString('hex')
    var params = [msg, fromAddress]
    var method = 'personal_sign'
    return new Promise((resolve, reject) => {
      ethereum.sendAsync({
        method,
        params,
        fromAddress
      }, function (err, result) {
        if (err) reject(err)
        if (result.error) reject(result.error)
        resolve(result.result)
      })
    })
  },

  getLinkConsent: (fromAddress, toDID, ethereum) => {
    const text = 'Create a new 3Box profile' +
      '\n\n' +
      '- \n' +
      'Your unique profile ID is ' + toDID
    var msg = '0x' + Buffer.from(text, 'utf8').toString('hex')
    var params = [msg, fromAddress]
    var method = 'personal_sign'
    return new Promise((resolve, reject) => {
      ethereum.sendAsync({
        method,
        params,
        fromAddress
      }, function (err, result) {
        if (err) reject(err)
        if (result.error) reject(result.error)
        const out = {
          msg: text,
          sig: result.result
        }
        resolve(out)
      })
    })
  },

  httpRequest: (url, method, payload) => {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest()
      request.onreadystatechange = () => {
        if (request.readyState === 4 && request.timeout !== 1) {
          if (request.status !== 200) {
            reject(request.responseText)
          } else {
            try {
              resolve(JSON.parse(request.response))
            } catch (jsonError) {
              reject(new Error(`[threeBox] while parsing data: '${String(request.responseText)}', error: ${String(jsonError)}`))
            }
          }
        }
      }
      request.open(method, url)
      request.setRequestHeader('accept', 'application/json')
      // request.setRequestHeader('accept', '*/*')
      if (method === 'POST') {
        request.setRequestHeader('Content-Type', `application/json`)
        request.send(JSON.stringify(payload))
      } else {
        request.setRequestHeader('Authorization', `Bearer ${payload}`)
        request.send()
      }
    })
  },
  sha256Multihash: str => {
    const digest = Buffer.from(sha256.digest(str))
    return Multihash.encode(digest, 'sha2-256').toString('hex')
  }
}
