const XMLHttpRequest = (typeof window !== 'undefined') ? window.XMLHttpRequest : require('xmlhttprequest').XMLHttpRequest

module.exports = {
  openBoxConsent: (fromAddress, web3provider) => {
    var text = 'Open 3box' // TODO - put real consent text here
    var msg = '0x' + Buffer.from(text, 'utf8').toString('hex')
    var params = [msg, fromAddress]
    var method = 'personal_sign'
    return new Promise((resolve, reject) => {
      web3provider.sendAsync({
        method,
        params,
        fromAddress,
      }, function (err, result) {
        if (err) reject(err)
        if (result.error) reject(result.error)
        resolve(result.result)
      })
    })
  },

  getLinkConsent: (fromAddress, toDID, web3provider) => {
    // TODO - erc712 signature, return a Promise
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
              reject(`[threeBox] while parsing data: '${String(request.responseText)}', error: ${String(jsonError)}`)
            }
          }
        }
      }
      request.open(method, url)
      request.setRequestHeader('accept', 'application/json')
      //request.setRequestHeader('accept', '*/*')
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
