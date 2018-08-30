const MuPort = require('muport-core')
const bip39 = require('bip39')
const store = require('store')
const ipfsAPI = require('ipfs-api')

const ProfileStore = require('./profileStore')
const PrivateStore = require('./privateStore')
const utils = require('./utils')

//TODO: Put real 3box-hash-server instance here ;)
const HASH_SERVER_URL = 'https://api.uport.me/3box-hash';

class ThreeBox {

  /**
   * Instantiates a threeBox
   *
   * @param     {MuPort}        muportDID                   A MuPort DID instance
   * @param     {Web3Provider}  web3provider                A Web3 provider
   * @return    {ThreeBox}                                  self
   */
  constructor (muportDID, web3provider, opts = {}) {
    this.muportDID = muportDID
    this.web3provider = web3provider
    this.rootObject = null
    if (store.get(this.muportDID.getDid())) {
      this.localCache = JSON.parse(store.get(this.muportDID.getDid()))
    } else {
      this.localCache = {}
    }
    this.ipfs = opts.ipfs || new ipfsAPI('ipfs.infura.io', '5001', {protocol: 'https'})

    /**
     * @property {ProfileStore} profileStore        access the profile store of the users threeBox
     */
    this.profileStore = new ProfileStore(this.ipfs, this._publishUpdate.bind(this, 'profile'), this._linkProfile.bind(this) )
    /**
     * @property {PrivateStore} privateStore        access the private store of the users threeBox
     */
    this.privateStore = new PrivateStore(muportDID, this.ipfs, this._publishUpdate.bind(this, 'datastore'))
  }

  /**
   * Get the public profile of the given address
   *
   * @param     {String}    address                 an ethereum address
   * @return    {Object}                         the threeBox instance for the given address
   */
  static async getProfile (address) {
    // TODO - get the hash associated with the address from the root-hash-tracker and get the profile object
    // should be simple getting: <multi-hash>/profile from ipfs.
    return {}
  }

  /**
   * Get the public activity of the given address
   *
   * @param     {String}    address                 an ethereum address
   * @return    {Object}                         the threeBox instance for the given address
   */
  static async getActivity (address) {
    return {}
  }

  /**
   * Opens the user space associated with the given address
   *
   * @param     {String}    address                 an ethereum address
   * @return    {ThreeBox}                         the threeBox instance for the given address
   */
  static async openBox (address, web3provider, opts = {}) {
    console.log('user', address)
    let muportDID
    let serializedMuDID = store.get('serializedMuDID_' + address)
    if (serializedMuDID) {
      muportDID = new MuPort(serializedMuDID)
    } else {
      const entropy = (await utils.openBoxConsent(address, web3provider)).slice(2, 34)
      const mnemonic = bip39.entropyToMnemonic(entropy)
      muportDID = await MuPort.newIdentity(null, null, {
        externalMgmtKey: address,
        mnemonic
      })
      store.set('serializedMuDID_' + address, muportDID.serializeState())
    }
    console.log('3box opened with', muportDID.getDid())
    let threeBox = new ThreeBox(muportDID, web3provider)
    await threeBox._sync()
    return threeBox
  }

  async _sync () {

    var rootHash;    
    try{
      const address = this.muportDID.getDidDocument().managementKey;
      //read root ipld object from 3box-hash-server
      const rootHashRes= (await utils.httpRequest(HASH_SERVER_URL+'/hash/'+address, 'GET')).data;
      console.log(rootHashRes)
      rootHash = rootHashRes.hash
    }catch(err){
      console.error(err)
    }
      
    //rootHash = 'QmeWkxbpY34yp13gen5L2wRkV8Vd1nDbP1kuoJVkuztyku' //TEST ONLY
    console.log(typeof rootHash);

    if(rootHash != undefined){
      //Get root ipld object from IPFS
      const ipfsRes=await this.ipfs.cat(rootHash);
      const rootObject = JSON.parse(ipfsRes.toString('utf8'));
      console.log(rootObject);
      this.rootObject = rootObject;
    }else{
      this.rootObject = {} 
    } 


    //Sync profile and privateStore
    //TODO: both can run in parallel.
    await this.profileStore._sync(this.rootObject.profile)
    await this.privateStore._sync(this.rootObject.datastore)
  }

  async _publishUpdate (store, hash) {
    console.log("publishUpdate ("+store+"):"+hash);
    //Update rootObject
    this.rootObject[store]=hash;
    console.log(this.rootObject);

    //Store rootObject on IPFS
    //QUESTION: Shoudn't we store the rootObject directly in 3box-hash-server
    const rootObjectStr = JSON.stringify(this.rootObject)
    const ipfsRes=await this.ipfs.add(new Buffer(rootObjectStr));
    const rootHash = ipfsRes[0].hash;
    console.log("rootHash: "+rootHash)

    //Sign rootHash
    const hashToken = await this.muportDID.signJWT({hash: rootHash});
    console.log("hashToken: "+hashToken);

    //TODO: Store hash on 3box-hash-server
    //servRes= (await utils.httpRequest(HASH_SERVER_URL+'/hash', 'POST', {hash_token: hashToken})).data;
    //console.log(servRes)

    //TODO: Verify servRes.hash == rootHash;
  }

  async _linkProfile () {
    if(!store.get("lastConsent")){

      const address = this.muportDID.getDidDocument().managementKey;
      const did=this.muportDID.getDid();
      console.log("3box._linkProfile: "+address +"->"+did)
  
      const consentSignature = await utils.getLinkConsent(address, did, this.web3provider)
    
      const linkData={
        consent_signature: consentSignature,
        linked_did: did
      }
      console.log(linkData);
      
      
      //TODO: send consentSignature to root-hash-tracker to link profile with ethereum address
      //linkRes= (await utils.httpRequest(HASH_SERVER_URL+'/link', 'POST', linkData)).data;
  
      //TOOD: check if did == linkRes.did and address == linkRes.address;
  
      //Store lastConsent into localstorage
      const lastConsent={
        address: address,
        did: did,
        signature: consentSignature
      }
      store.set("lastConsent",lastConsent)

    }


  }

  _clearCache () {
    store.remove('serializedMuDID_' + this.muportDID.getDidDocument().managementKey)
  }

  //async postEvent (payload) {
    //const encrypted = this.muportDID.symEncrypt(JSON.stringify(payload))
    //const event_token = await this.muportDID.signJWT({
      //previous: this.previous,
      //event: encrypted.ciphertext + '.' + encrypted.nonce
    //})
    //this.previous = (await utils.httpRequest(CALEUCHE_URL, 'POST', {event_token})).data.id
    //console.log('added event with id', this.previous)
  //}
}

module.exports = ThreeBox
