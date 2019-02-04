const graphQLRequest = require('graphql-request').request
const utils = require('./utils/index')
const config = require('./config.js')

const GRAPHQL_SERVER_URL = config.graphql_server_url
const PROFILE_SERVER_URL = config.profile_server_url
const ADDRESS_SERVER_URL = config.address_server_url

async function getRootStoreAddress (identifier, serverUrl = ADDRESS_SERVER_URL) {
  // read orbitdb root store address from the 3box-address-server
  const res = await utils.fetchJson(serverUrl + '/odbAddress/' + identifier)
  if (res.status === 'success') {
    return res.data.rootStoreAddress
  } else {
    throw new Error(res.message)
  }
}

async function getProfile (address, serverUrl = PROFILE_SERVER_URL) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await utils.fetchJson(serverUrl + '/profile?address=' + encodeURIComponent(address))
      resolve(res)
    } catch (err) {
      reject(err)
    }
  })
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

module.exports = { profileGraphQL, getProfile, getRootStoreAddress, getProfiles }
