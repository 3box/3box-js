class Box {
  constructor (DID, ethereumProvider, opts = {}) {
    this._publicStore = {}
    this._privateStore = {}
    this._3id = {
      muportDID: DID.replace('3', 'muport')
    }
    this.public = {
      set: (k, v) => this._publicStore[k] = v,
      get: (k) => this._publicStore[k]
    },
    this.private = {
      set: (k, v) => this._privateStore[k] = v,
      get: (k) => this._privateStore[k]
    }
    this.DID = DID
  }

  static async openBox (address, ethereumProvider, opts = {}) {
    let did = 'did:3:' + address
    return new Box(did, ethereumProvider, opts)
  }
}

module.exports = Box
