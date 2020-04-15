const { createLink } = require('3id-blockchain-utils')

class AccountLinks {
  constructor (ceramic, provider) {
    this._ceramic = ceramic
    this.provider = provider
  }

  async create (address, did, proof = null) {
    const doc = await this._ceramic.createDocument(null, 'account-link', {
      owners: [this._convertToCaip10(address)]
    })
    if (!proof) {
      if (!this.provider) {
        throw new Error('Provider must be set to create an account link')
      }
      proof = await createLink(did, address, this.provider)
    }
    await doc.change(proof)
    return doc.content
  }

  async read (address) {
    const docId = await this._getDocId(address)
    const doc = await this._ceramic.loadDocument(docId)
    await new Promise(resolve => setTimeout(resolve, 500))
    return doc.content
  }

  async update (address, did, proof = null) {
    if (!proof) {
      if (!this.provider) {
        throw new Error('Provider must be set to update an account link')
      }
      proof = await createLink(did, address, this.provider)
    }
    const docId = await this._getDocId(address)
    const doc = await this._ceramic.loadDocument(docId)
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

  async _getDocId (address) {
    const doc = await this._ceramic.createDocument(null, 'account-link', {
      owners: [this._convertToCaip10(address)],
      onlyGenesis: true,
      skipWait: true
    })
    return doc.id
  }

  _convertToCaip10 (address) {
    let [accountAddress, chainId] = address.split('@')
    if (!chainId) chainId = 'eip155:' + ((this.provider && this.provider.networkVersion) || '1')
    return [accountAddress, chainId].join('@').toLowerCase()
  }
}

module.exports = AccountLinks
