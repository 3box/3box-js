import nodeFetch from 'node-fetch'
const fetch = (typeof window !== 'undefined') ? window.fetch : nodeFetch
import Multihash from 'multihashes'
import { sha256 } from 'js-sha256'

export function openBoxConsent (fromAddress, ethereum) {
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
}

export function openSpaceConsent (fromAddress, ethereum, name) {
  const text = `Allow this app to open your ${name} space.`
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
}

export function getLinkConsent(fromAddress, toDID, ethereum) {
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
}

export async function fetchJson(url, body) {
  let opts
  if (body) {
    opts = { body: JSON.stringify(body), method: 'POST', headers: { 'Content-Type': 'application/json' } }
  }
  return (await fetch(url, opts)).json()
}

export async function fetchText(url, opts) {
  return (await fetch(url, opts)).text()
}

export function sha256Multihash (str) {
  const digest = Buffer.from(sha256.digest(str))
  return Multihash.encode(digest, 'sha2-256').toString('hex')
}

const utils = { sha256, openBoxConsent, openSpaceConsent, getLinkConsent, fetchJson, fetchText, sha256Multihash }
export { utils as default, sha256}
