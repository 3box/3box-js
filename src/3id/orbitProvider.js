// const Identities = require('orbit-db-identity-provider')
const IdentityProvider = require('orbit-db-identity-provider/src/identity-provider-interface.js')


class OrbitIdentityProvider {
  constructor (options={}) {
    // super(options)
    console.log('create new identity')
    console.log(options)
    this.pubKey = options.pubKey
    console.log('pubkey')
    console.log(this.pubKey)
  }

  static get type () { return '3ID' } // return type
  // return identifier of external id (eg. a public key)
  async getId () {
    return this.pubKey
  }
  //return a signature of data (signature of the OrbtiDB public key)
  async signIdentity (data) {
    return 'signedstring'
  }

   //return true if identity.sigantures are valid
  static async verifyIdentity (identity) {
    console.log(identity)
    return true
   }
}


module.exports =  OrbitIdentityProvider

// Identities.addIdentityProvider(MyIdentityProvider)

// to create an identity of type `MyIdentityType`
// const identity = await Identities.createIdentity({ type: `MyIdentityType`})

// module.exports = (pubKey) => {
//   return new OrbitProvider(pubkey )
// }
