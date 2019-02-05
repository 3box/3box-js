import { request as graphQLRequest } from 'graphql-request'
import utils from './utils/index'
import config from './config.js'

const GRAPHQL_SERVER_URL = config.graphql_server_url
const PROFILE_SERVER_URL = config.profile_server_url
const ADDRESS_SERVER_URL = config.address_server_url

export async function getRootStoreAddress (identifier, serverUrl = ADDRESS_SERVER_URL) {
  // read orbitdb root store address from the 3box-address-server
  const res = await utils.fetchJson(serverUrl + '/odbAddress/' + identifier)
  if (res.status === 'success') {
    return res.data.rootStoreAddress
  } else {
    throw new Error(res.message)
  }
}

export async function getProfile (address, serverUrl = PROFILE_SERVER_URL) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await utils.fetchJson(serverUrl + '/profile?address=' + encodeURIComponent(address))
      resolve(res)
    } catch (err) {
      reject(err)
    }
  })
}

export async function getProfiles (addressArray, opts = {}) {
  opts = Object.assign({ profileServer: PROFILE_SERVER_URL }, opts)
  const req = { addressList: addressArray }
  const url = `${opts.profileServer}/profileList`
  return utils.fetchJson(url, req)
}

export async function profileGraphQL (query, opts = {}) {
  opts = Object.assign({ graphqlServer: GRAPHQL_SERVER_URL }, opts)
  return graphQLRequest(opts.graphqlServer, query)
}

export default { profileGraphQL, getProfile, getRootStoreAddress, getProfiles }
