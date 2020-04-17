const { createLink } = require('3id-blockchain-utils')
const utils = require('./utils')

class AccountLinks {
  constructor (ceramic, provider) {
    this._ceramic = ceramic
    this.provider = provider
  }

  async create (address, did, proof = null) {
    if (!proof) {
      if (!this.provider) {
        throw new Error('Provider must be set')
      }
      proof = await createLink(did, address, this.provider)
    }
    const doc = await this._ceramic.createDocument(null, 'account-link', {
      owners: [await this._convertToCaip10(proof.address)],
      onlyGenesis: true
    })
    if (doc.content !== did) {
      await doc.change(proof)
    }
    return doc.content
  }

  async read (address) {
    const doc = await this._ceramic.createDocument(null, 'account-link', {
      owners: [await this._convertToCaip10(address)],
      onlyGenesis: true
    })
    return doc.content
  }

  async update (address, did, proof = null) {
    if (!proof) {
      if (!this.provider) {
        throw new Error('Provider must be set')
      }
      proof = await createLink(did, address, this.provider)
    }
    const doc = await this._ceramic.createDocument(null, 'account-link', {
      owners: [await this._convertToCaip10(proof.address)],
      onlyGenesis: true
    })
    await doc.change(proof)
    return doc.content
  }

  // TODO: https://github.com/ceramicnetwork/ceramic/issues/11
  async delete (address) {
    throw new Error('Not implemented')
  }

  // TODO: https://github.com/3box/3box/issues/1022
  async getAddresses (did) {
    throw new Error('Not implemented')
  }

  async _convertToCaip10 (address) {
    let [accountAddress, chainId] = address.split('@')
    if (!chainId) {
      let netVersion
      try {
        netVersion = await utils.callRpc(this.provider, 'net_version')
      } catch (err) {
        console.warn('Provider RPC error, defaulting net_version to "1"', err)
        netVersion = '1'
      }
      chainId = 'eip155:' + netVersion
    }
    return [accountAddress, chainId].join('@').toLowerCase()
  }
}

module.exports = AccountLinks
