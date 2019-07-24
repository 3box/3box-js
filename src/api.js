const graphQLRequest = require('graphql-request').request
const utils = require('./utils/index')
const verifier = require('./utils/verifier')
const { isMuportDID } = require('./utils/id')
const config = require('./config.js')

const GRAPHQL_SERVER_URL = config.graphql_server_url
const PROFILE_SERVER_URL = config.profile_server_url
const ADDRESS_SERVER_URL = config.address_server_url

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

async function getSpace (address, name, serverUrl = PROFILE_SERVER_URL, { metadata, blocklist } = {}) {
  if (blocklist && blocklist(address)) throw new Error(`user with ${address} is blocked`)
  let url = `${serverUrl}/space`

  try {
    // Add first parameter: address or did
    if (isMuportDID(address)) {
      url = `${url}?did=${encodeURIComponent(address)}`
    } else {
      url = `${url}?address=${encodeURIComponent(address.toLowerCase())}`
    }

    // Add name:
    url = `${url}&name=${encodeURIComponent(name)}`

    // Add metadata:
    if (metadata) {
      url = `${url}&metadata=${encodeURIComponent(metadata)}`
    }

    // Query:
    // we await explicitly to make sure the error is catch'd in the correct scope
    return await utils.fetchJson(url)
  } catch (err) {
    return {}
  }
}

// TODO consumes address now, could also give root DID to get space DID
async function getSpaceDID (address, space, opts = {}) {
  const conf = await getConfig(address, opts)
  if (!conf.spaces[space] || !conf.spaces[space].DID) throw new Error(`Could not find appropriate DID for address ${address}`)
  return conf.spaces[space].DID
}

async function getThread (space, name, firstModerator, members, opts = {}) {
  const serverUrl = opts.profileServer || PROFILE_SERVER_URL
  if (firstModerator.startsWith('0x')) {
    firstModerator = await getSpaceDID(firstModerator, space, opts)
  }
  try {
    let url = `${serverUrl}/thread?space=${encodeURIComponent(space)}&name=${encodeURIComponent(name)}`
    url += `&mod=${encodeURIComponent(firstModerator)}&members=${encodeURIComponent(members)}`
    return await utils.fetchJson(url)
  } catch (err) {
    throw new Error(err)
  }
}

async function getThreadByAddress (address, opts = {}) {
  const serverUrl = opts.profileServer || PROFILE_SERVER_URL
  try {
    return await utils.fetchJson(`${serverUrl}/thread?address=${encodeURIComponent(address)}`)
  } catch (err) {
    throw new Error(err)
  }
}

async function getConfig (address, opts = {}) {
  const serverUrl = opts.profileServer || PROFILE_SERVER_URL
  try {
    return await utils.fetchJson(`${serverUrl}/config?address=${encodeURIComponent(address)}`)
  } catch (err) {
    throw new Error(err)
  }
}

async function getProfile (address, serverUrl = PROFILE_SERVER_URL, { metadata, blocklist } = {}) {
  if (blocklist && blocklist(address)) throw new Error(`user with ${address} is blocked`)
  let url = `${serverUrl}/profile`

  try {
    // Add first parameter: address or did
    if (isMuportDID(address)) {
      url = `${url}?did=${encodeURIComponent(address)}`
    } else {
      url = `${url}?address=${encodeURIComponent(address.toLowerCase())}`
    }

    // Add metadata:
    if (metadata) {
      url = `${url}&metadata=${encodeURIComponent(metadata)}`
    }

    // Query:
    // we await explicitly to make sure the error is catch'd in the correct scope
    return await utils.fetchJson(url)
  } catch (err) {
    return {} // empty profile
  }
}

async function getProfiles (addressArray, opts = {}) {
  opts = Object.assign({ profileServer: PROFILE_SERVER_URL }, opts)
  const req = { addressList: [], didList: [] }

  // Split addresses on ethereum / dids
  addressArray.forEach(address => {
    if (isMuportDID(address)) {
      req.didList.push(address)
    } else {
      req.addressList.push(address)
    }
  })

  const url = `${opts.profileServer}/profileList`
  return utils.fetchJson(url, req)
}

async function profileGraphQL (query, opts = {}) {
  opts = Object.assign({ graphqlServer: GRAPHQL_SERVER_URL }, opts)
  return graphQLRequest(opts.graphqlServer, query)
}

async function getVerifiedAccounts (profile) {
  const verifs = {}
  try {
    const did = await verifier.verifyDID(profile.proof_did)

    verifs.did = did

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
    if (profile.ethereum_proof) {
      try {
        verifs.ethereum = await verifier.verifyEthereum(profile.ethereum_proof, did)
      } catch (err) {
        // Invalid eth verification
      }
    }
  } catch (err) {
    // Invalid proof for DID return an empty profile
  }
  return verifs
}

module.exports = { profileGraphQL, getProfile, getSpace, listSpaces, getThread, getThreadByAddress, getConfig, getRootStoreAddress, getProfiles, getVerifiedAccounts, getSpaceDID }
