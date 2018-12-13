class Box {

  constructor (muportDID, ethereumProvider, opts = {}) {
    this._publicStore = {}
    this._muportDID = {
      getDid : () => muportDID
    }
    this.public = {
      set: (k, v) => this._publicStore[k] = v,
      get: (k) => this._publicStore[k]
    }
  }

  static async openBox (address, ethereumProvider, opts = {}) {
    let did = "did:muport:"+address
    return new Box(did, ethereumProvider, opts);
  }
  
}

module.exports = Box
