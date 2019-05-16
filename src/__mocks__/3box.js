class Box {
  constructor (muportDID, ethereumProvider, opts = {}) {
    this._publicStore = {}
    this._privateStore = {}
    this._3id = {
      muportDID: muportDID
    }
    this.public = {
      set: (k, v) => this._publicStore[k] = v,
      get: (k) => this._publicStore[k]
    },
    this.private = {
      set: (k, v) => this._privateStore[k] = v,
      get: (k) => this._privateStore[k]
    }
  }

  static async openBox (address, ethereumProvider, opts = {}) {
    let did = 'did:muport:' + address
    return new Box(did, ethereumProvider, opts)
  }
}

module.exports = Box
