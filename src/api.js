const graphQLRequest = require('graphql-request').request
const utils = require('./utils/index')
const verifier = require('./utils/verifier')
const config = require('./config.js')

const GRAPHQL_SERVER_URL = config.graphql_server_url
const PROFILE_SERVER_URL = config.profile_server_url
const ADDRESS_SERVER_URL = config.address_server_url

const DID_MUPORT_PREFIX = 'did:muport:'
const isMuportDID = (address) => address.startsWith(DID_MUPORT_PREFIX)

async function getRootStoreAddress (identifier, serverUrl = ADDRESS_SERVER_URL) {
  // read orbitdb root store address from the 3box-address-server
  const res = await utils.fetchJson(serverUrl + '/odbAddress/' + identifier)
  return res.data.rootStoreAddress
}

async function listSpaces (address, serverUrl = PROFILE_SERVER_URL) {
  try {
    // we await explicitly here to make sure the error is catch'd in the correct scope
    if (isMuportDID(address)) {
      return await utils.fetchJson(serverUrl + '/list-spaces?did=' + encodeURIComponent(address))
    } else {
      return await utils.fetchJson(serverUrl + '/list-spaces?address=' + encodeURIComponent(address))
    }
  } catch (err) {
    return []
  }
}

async function getSpace (address, name, serverUrl = PROFILE_SERVER_URL) {
  try {
    // we await explicitly here to make sure the error is catch'd in the correct scope
    if (isMuportDID(address)) {
      return await utils.fetchJson(serverUrl + `/space?did=${encodeURIComponent(address)}&name=${encodeURIComponent(name)}`)
    } else {
      return await utils.fetchJson(serverUrl + `/space?address=${encodeURIComponent(address)}&name=${encodeURIComponent(name)}`)
    }
  } catch (err) {
    return {}
  }
}

async function getThread (space, name, serverUrl = PROFILE_SERVER_URL) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await utils.fetchJson(serverUrl + `/thread?space=${encodeURIComponent(space)}&name=${encodeURIComponent(name)}`)
      resolve(res)
    } catch (err) {
      reject(err)
    }
  })
}

async function getProfile (address, serverUrl = PROFILE_SERVER_URL) {
  try {
    // Note: we await explicitly to make sure the error is catch'd in the correct scope
    if (isMuportDID(address)) {
      const normalized = encodeURIComponent(address) // uppercase is significant in did:muport
      return await utils.fetchJson(serverUrl + '/profile?did=' + normalized)
    } else {
      const normalized = encodeURIComponent(address.toLowerCase())
      return await utils.fetchJson(serverUrl + '/profile?address=' + normalized)
    }
  } catch (err) {
    return {} // empty profile
  }
}

async function getProfiles (addressArray, opts = {}) {
  opts = Object.assign({ profileServer: PROFILE_SERVER_URL }, opts)
  const req = { addressList: addressArray }
  const url = `${opts.profileServer}/profileList`
  return utils.fetchJson(url, req)
}

async function profileGraphQL (query, opts = {}) {
  opts = Object.assign({ graphqlServer: GRAPHQL_SERVER_URL }, opts)
  return graphQLRequest(opts.graphqlServer, query)
}

async function getVerifiedAccounts (profile) {
  let verifs = {}
  try {
    const did = await verifier.verifyDID(profile.proof_did)
    if (profile.proof_github) {
      try {
        verifs.github = await verifier.verifyGithub(did, profile.proof_github)
      } catch (err) {
        // Invalid github verification
      }
    }
    if (profile.proof_twitter) {
      try {
        verifs.twitter = await verifier.verifyTwitter(did, profile.proof_twitter)
      } catch (err) {
        // Invalid twitter verification
      }
    }
  } catch (err) {
    // Invalid proof for DID return an empty profile
  }
  return verifs
}

module.exports = { profileGraphQL, getProfile, getSpace, listSpaces, getThread, getRootStoreAddress, getProfiles, getVerifiedAccounts }
