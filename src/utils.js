const XMLHttpRequest = (typeof window !== 'undefined') ? window.XMLHttpRequest : require('xmlhttprequest').XMLHttpRequest

module.exports = {
  openBoxConsent: (fromAddress, web3provider) => {
    const text = 'This dApp wants to access your 3Box, to:\n' +
            '* store public and private data about you\n' +
            '* read public and private data about you\n' +
            '* remove private data about you\n\n' +
            'You are always in control of your data. Create your public profile at https://my.3Box.io'
    var msg = '0x' + Buffer.from(text, 'utf8').toString('hex')
    var params = [msg, fromAddress]
    var method = 'personal_sign'
    return new Promise((resolve, reject) => {
      web3provider.sendAsync({
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

  getLinkConsent: (fromAddress, toDID, web3provider) => {
    const text = 'I consent to link my address: \n' +
      fromAddress + '\n' +
      'to my public profile\n\n' +
      'Disclaimer: public data is public forever and can not be unassociated from this profile. ' +
      'Even if updates, the original entries will persist.'
    var msg = '0x' + Buffer.from(text, 'utf8').toString('hex')
    var params = [msg, fromAddress]
    var method = 'personal_sign'
    return new Promise((resolve, reject) => {
      web3provider.sendAsync({
        method,
        params,
        fromAddress
      }, function (err, result) {
        if (err) reject(err)
        if (result.error) reject(result.error)
        const out = {
          msg: msg,
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
            console.log(request)
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
  }
}
