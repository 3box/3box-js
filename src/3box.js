const MuPort = require('muport-core')
const bip39 = require('bip39')
const localstorage = require('store')
const ipfsAPI = require('ipfs-api')
const DAGNode = require('ipld-dag-pb').DAGNode

const ProfileStore = require('./profileStore')
const PrivateStore = require('./privateStore')
const utils = require('./utils')

//TODO: Put production 3box-hash-server instance here ;)
const HASH_SERVER_URL = 'https://api.uport.space/hash-server';

class ThreeBox {

  /**
   * Instantiates a threeBox
   *
   * @param     {MuPort}        muportDID                   A MuPort DID instance
   * @param     {Web3Provider}  web3provider                A Web3 provider
   * @param     {Object}        opts                        Optional parameters
   * @param     {IPFS}          opts.ipfs                   A custom ipfs instance
   * @return    {ThreeBox}                                  self
   */
  constructor (muportDID, web3provider, opts = {}) {
    this.muportDID = muportDID
    this.web3provider = web3provider
    this.rootObject = null
    if (localstorage.get(this.muportDID.getDid())) {
      this.localCache = JSON.parse(localstorage.get(this.muportDID.getDid()))
    } else {
      this.localCache = {}
    }
    this.ipfs = opts.ipfs || new ipfsAPI('ipfs.infura.io', '5001', {protocol: 'https'})

    /**
     * @property {ProfileStore} profileStore        access the profile store of the users threeBox
     */
    this.profileStore = new ProfileStore(this.ipfs, this._publishUpdate.bind(this, 'profile'))
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
    throw new Error ('Not implemented yet. Use threeBox.profileStore')
    // TODO - get the hash associated with the address from the root-hash-tracker and get the profile object
    // should be simple getting: <multi-hash>/profile from ipfs.
    return {}
  }

  /**
   * Opens the user space associated with the given address
   *
   * @param     {String}        address                 an ethereum address
   * @param     {Web3Provider}  web3provider            A Web3 provider
   * @param     {Object}        opts                    Optional parameters
   * @param     {IPFS}          opts.ipfs               A custom ipfs instance
   * @return    {ThreeBox}                              the threeBox instance for the given address
   */
  static async openBox (address, web3provider, opts = {}) {
    console.log('user', address)
    let muportDID
    let serializedMuDID = localstorage.get('serializedMuDID_' + address)
    if (serializedMuDID) {
      muportDID = new MuPort(serializedMuDID)
    } else {
      const entropy = (await utils.openBoxConsent(address, web3provider)).slice(2, 34)
      const mnemonic = bip39.entropyToMnemonic(entropy)
      muportDID = await MuPort.newIdentity(null, null, {
        externalMgmtKey: address,
        mnemonic
      })
      localstorage.set('serializedMuDID_' + address, muportDID.serializeState())
    }
    console.log('3box opened with', muportDID.getDid())
    let threeBox = new ThreeBox(muportDID, web3provider, opts)
    await threeBox._sync()
    return threeBox
  }

  async _sync () {
    let rootHash;
    try{
      const did = this.muportDID.getDid()
      //read root ipld object from 3box-hash-server
      rootHash = (await utils.httpRequest(HASH_SERVER_URL+'/hash/' + did, 'GET')).data.hash;
    }catch(err){
      console.error(err)
    }

    if (rootHash) {
      //Get root ipld object from IPFS
      this.rootDAGNode = await this.ipfs.object.get(rootHash)
      if (!this.rootDAGNode.links.length) {
        // We got some random object from ipfs, create a real root object
        this.rootDAGNode = await createDAGNode('', [])
      }
    } else {
      this.rootDAGNode = await createDAGNode('', [])
    }
    // start with an empty DAGNode if one was not created
    console.log('rootDAGNode', this.rootDAGNode)

    //Sync profile and privateStore
    //TODO: both can run in parallel.
    let profileLink = this.rootDAGNode.links.filter(link => link.name === 'profile')[0]
    await this.profileStore._sync(profileLink ? profileLink.toJSON().multihash : null)
    let datastoreLink = this.rootDAGNode.links.filter(link => link.name === 'profile')[0]
    await this.privateStore._sync(datastoreLink ? datastoreLink.toJSON().multihash : null)
  }

  async _publishUpdate (storeName, hash) {
    console.log("publishUpdate ("+storeName+"):"+hash);
    if (storeName === 'profile') {
      await this._linkProfile();
    }

    //Update rootObject
    this.rootDAGNode = await updateDAGNodeLink(this.rootDAGNode, storeName, hash)

    //Store rootObject on IPFS
    const rootHash = this.rootDAGNode.toJSON().multihash
    console.log("rootHash: "+rootHash)
    try {
      const ipfsRes = await this.ipfs.object.put(this.rootDAGNode)
      console.log(ipfsRes)
    } catch (e) {
      // TODO - handle any errors here
      console.error(e)
    }

    //Sign rootHash
    const hashToken = await this.muportDID.signJWT({hash: rootHash});
    console.log("hashToken: "+hashToken);

    //Store hash on 3box-hash-server
    const servRes= (await utils.httpRequest(HASH_SERVER_URL+'/hash', 'POST', {hash_token: hashToken})).data;
    console.log(servRes)

    //TODO: Verify servRes.hash == rootHash;
    return true
  }

  async _linkProfile () {
    if(!localstorage.get("lastConsent")){

      const address = this.muportDID.getDidDocument().managementKey;
      const did=this.muportDID.getDid();
      console.log("3box._linkProfile: "+address +"->"+did)

      const consent = await utils.getLinkConsent(address, did, this.web3provider)
      const linkData={

        consent_msg: consent.msg,
        consent_signature: consent.sig,
        linked_did: did
      }
      console.log(linkData);


      //Send consentSignature to root-hash-tracker to link profile with ethereum address
      const linkRes= (await utils.httpRequest(HASH_SERVER_URL+'/link', 'POST', linkData)).data;

      //TOOD: check if did == linkRes.did and address == linkRes.address;
      console.log(linkRes);

      //Store lastConsent into localstorage
      const lastConsent={
        address: address,
        did: did,
        consent: consent
      }
      localstorage.set("lastConsent",lastConsent)

    }else{
      console.log("profile linked");
    }


  }

  _clearCache () {
    localstorage.remove('serializedMuDID_' + this.muportDID.getDidDocument().managementKey)
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

const createDAGNode = (data, links) => new Promise((resolve, reject) => {
  DAGNode.create(data, links, (err, node) => {
    if (err) reject(err)
    resolve(node)
  })
})

const updateDAGNodeLink = (node, name, multihash) => new Promise((resolve, reject) => {
  DAGNode.rmLink(node, name, (err, clearedNode) => {
    if (err) reject(err)
    // size has to be set to a non-zero value
    DAGNode.addLink(clearedNode, {name, multihash, size: 1}, (err, newNode) => {
      if (err) reject(err)
      resolve(newNode)
    })
  })
})

module.exports = ThreeBox
