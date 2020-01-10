const graphQLRequest = require('graphql-request').request
const utils = require('./utils/index')
const verifier = require('./utils/verifier')
const { isSupportedDID } = require('./utils/id')
const config = require('./config.js')

const GRAPHQL_SERVER_URL = config.graphql_server_url
const PROFILE_SERVER_URL = config.profile_server_url
const ADDRESS_SERVER_URL = config.address_server_url

/**
 * @class
 */
class BoxApi {
  static async getRootStoreAddress (identifier, serverUrl = ADDRESS_SERVER_URL) {
    // read orbitdb root store address from the 3box-address-server
    const res = await utils.fetchJson(serverUrl + '/odbAddress/' + identifier)
    return res.data.rootStoreAddress
  }

  /**
   * Get the names of all spaces a user has
   *
   * @param     {String}    address                 An ethereum address
   * @param     {Object}    opts                    Optional parameters
   * @param     {String}    opts.profileServer      URL of Profile API server
   * @return    {Object}                            an array with all spaces as strings
   */
  static async listSpaces (address, { profileServer } = {}) {
    const serverUrl = profileServer || PROFILE_SERVER_URL
    try {
      // we await explicitly here to make sure the error is catch'd in the correct scope
      if (isSupportedDID(address)) {
        return await utils.fetchJson(serverUrl + '/list-spaces?did=' + address)
      } else {
        return await utils.fetchJson(serverUrl + '/list-spaces?address=' + encodeURIComponent(address))
      }
    } catch (err) {
      return []
    }
  }

  /**
   * Get the public data in a space of a given address with the given name
   *
   * @param     {String}    address                 An ethereum address
   * @param     {String}    name                    A space name
   * @param     {Object}    opts                    Optional parameters
   * @param     {Function}  opts.blocklist          A function that takes an address and returns true if the user has been blocked
   * @param     {String}    opts.metadata           flag to retrieve metadata
   * @param     {String}    opts.profileServer      URL of Profile API server
   * @return    {Object}                            a json object with the public space data
   */
  static async getSpace (address, name, { profileServer, metadata, blocklist } = {}) {
    if (blocklist && blocklist(address)) throw new Error(`user with ${address} is blocked`)
    const serverUrl = profileServer || PROFILE_SERVER_URL
    let url = `${serverUrl}/space`

    try {
      // Add first parameter: address or did
      if (isSupportedDID(address)) {
        url = `${url}?did=${address}`
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
  static async getSpaceDID (address, space, opts = {}) {
    const conf = await BoxApi.getConfig(address, opts)
    if (!conf.spaces[space] || !conf.spaces[space].DID) throw new Error(`Could not find appropriate DID for address ${address}`)
    return conf.spaces[space].DID
  }

  /**
   * Get all posts that are made to a thread.
   *
   * @param     {String}    space                   The name of the space the thread is in
   * @param     {String}    name                    The name of the thread
   * @param     {String}    firstModerator          The DID (or ethereum address) of the first moderator
   * @param     {Boolean}   members                 True if only members are allowed to post
   * @param     {Object}    opts                    Optional parameters
   * @param     {String}    opts.profileServer      URL of Profile API server
   * @return    {Array<Object>}                     An array of posts
   */
  static async getThread (space, name, firstModerator, members, opts = {}) {
    const serverUrl = opts.profileServer || PROFILE_SERVER_URL
    if (firstModerator.startsWith('0x')) {
      firstModerator = await BoxApi.getSpaceDID(firstModerator, space, opts)
    }
    try {
      let url = `${serverUrl}/thread?space=${encodeURIComponent(space)}&name=${encodeURIComponent(name)}`
      url += `&mod=${encodeURIComponent(firstModerator)}&members=${encodeURIComponent(members)}`
      return await utils.fetchJson(url)
    } catch (err) {
      throw new Error(err)
    }
  }

  /**
   * Get all posts that are made to a thread.
   *
   * @param     {String}    address                 The orbitdb-address of the thread
   * @param     {Object}    opts                    Optional parameters
   * @param     {String}    opts.profileServer      URL of Profile API server
   * @return    {Array<Object>}                     An array of posts
   */
  static async getThreadByAddress (address, opts = {}) {
    const serverUrl = opts.profileServer || PROFILE_SERVER_URL
    try {
      return await utils.fetchJson(`${serverUrl}/thread?address=${encodeURIComponent(address)}`)
    } catch (err) {
      throw new Error(err)
    }
  }

  /**
   * Get the configuration of a users 3Box
   *
   * @param     {String}    address                 The ethereum address
   * @param     {Object}    opts                    Optional parameters
   * @param     {String}    opts.profileServer      URL of Profile API server
   * @return    {Array<Object>}                     An array of posts
   */
  static async getConfig (address, opts = {}) {
    const serverUrl = opts.profileServer || PROFILE_SERVER_URL
    const isAddr = address.startsWith('0x') // assume 3ID if not address
    try {
      return await utils.fetchJson(`${serverUrl}/config?${isAddr ? 'address' : 'did'}=${encodeURIComponent(address)}`)
    } catch (err) {
      throw new Error(err)
    }
  }

  /**
   * Get the public profile of a given address
   *
   * @param     {String}    address                 An ethereum address
   * @param     {Object}    opts                    Optional parameters
   * @param     {Function}  opts.blocklist          A function that takes an address and returns true if the user has been blocked
   * @param     {String}    opts.metadata           flag to retrieve metadata
   * @param     {String}    opts.profileServer      URL of Profile API server
   * @return    {Object}                            a json object with the profile for the given address
   */
  static async getProfile (address, { profileServer, metadata, blocklist } = {}) {
    if (blocklist && blocklist(address)) throw new Error(`user with ${address} is blocked`)
    const serverUrl = profileServer || PROFILE_SERVER_URL
    let url = `${serverUrl}/profile`

    try {
      // Add first parameter: address or did
      if (isSupportedDID(address)) {
        url = `${url}?did=${address}`
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

  /**
   * Get a list of public profiles for given addresses. This relies on 3Box profile API.
   *
   * @param     {Array}     address                 An array of ethereum addresses
   * @param     {Object}    opts                    Optional parameters
   * @param     {String}    opts.profileServer      URL of Profile API server
   * @return    {Object}                            a json object with each key an address and value the profile
   */
  static async getProfiles (addressArray, opts = {}) {
    opts = Object.assign({ profileServer: PROFILE_SERVER_URL }, opts)
    const req = { addressList: [], didList: [] }

    // Split addresses on ethereum / dids
    addressArray.forEach(address => {
      if (isSupportedDID(address)) {
        req.didList.push(address)
      } else {
        req.addressList.push(address)
      }
    })

    const url = `${opts.profileServer}/profileList`
    return utils.fetchJson(url, req)
  }

  /**
   * GraphQL for 3Box profile API
   *
   * @param     {Object}    query               A graphQL query object.
   * @param     {Object}    opts                Optional parameters
   * @param     {String}    opts.graphqlServer  URL of graphQL 3Box profile service
   * @return    {Object}                        a json object with each key an address and value the profile
   */
  static async profileGraphQL (query, opts = {}) {
    opts = Object.assign({ graphqlServer: GRAPHQL_SERVER_URL }, opts)
    return graphQLRequest(opts.graphqlServer, query)
  }

  /**
   * Verifies the proofs of social accounts that is present in the profile.
   *
   * @param     {Object}            profile                 A user profile object, received from the `getProfile` function
   * @return    {Object}                                    An object containing the accounts that have been verified
   */
  static async getVerifiedAccounts (profile) {
    const verifs = {}
    try {
      const didVerified = await verifier.verifyDID(profile.proof_did)
      const dids = [didVerified.did]
      verifs.did = didVerified.did

      if (didVerified.muport) {
        verifs.muport = didVerified.muport
        dids.push(didVerified.muport)
      }

      if (profile.proof_github) {
        try {
          verifs.github = await verifier.verifyGithub(dids, profile.proof_github)
        } catch (err) {
          // Invalid github verification
        }
      }
      if (profile.proof_twitter) {
        try {
          verifs.twitter = await verifier.verifyTwitter(dids, profile.proof_twitter)
        } catch (err) {
          // Invalid twitter verification
        }
      }
      if (profile.ethereum_proof) {
        try {
          // won't be any proofs here with 3id
          verifs.ethereum = await verifier.verifyEthereum(profile.ethereum_proof, verifs.did)
        } catch (err) {
          // Invalid eth verification
        }
      }
    } catch (err) {
      // Invalid proof for DID return an empty profile
    }
    return verifs
  }
}

module.exports = BoxApi
