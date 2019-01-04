[![CircleCI](https://img.shields.io/circleci/project/github/3box/3box-js.svg?style=for-the-badge)](https://circleci.com/gh/3box/3box-js)
[![Discord](https://img.shields.io/discord/484729862368526356.svg?style=for-the-badge)](https://discordapp.com/invite/Z3f3Cxy)
[![npm](https://img.shields.io/npm/dt/3box.svg?style=for-the-badge)](https://www.npmjs.com/package/3box)
[![npm](https://img.shields.io/npm/v/3box.svg?style=for-the-badge)](https://www.npmjs.com/package/3box)
[![Codecov](https://img.shields.io/codecov/c/github/uport-project/3box-js.svg?style=for-the-badge)](https://codecov.io/gh/uport-project/3box-js)
[![Twitter Follow](https://img.shields.io/twitter/follow/3boxdb.svg?style=for-the-badge&label=Twitter)](https://twitter.com/3boxdb)
[![Greenkeeper badge](https://badges.greenkeeper.io/3box/3box-js.svg)](https://greenkeeper.io/)

[Install](#install) | [Usage](#usage) | [Dapp data](#dappdata) | [Example](#example) | [API Docs](#api)

# 3box-js

This is a library which allows you to set, get, and remove private and public data associated with an ethereum account. It can be used to store identity data, user settings, etc. by dapps that use a web3 enabled browser. The data will be retrievable as long as the user has access to the private key for the used ethereum account. The data is encrypted and can not be read by any third party that the user hasn't authorized. Currently it supports one shared space which all dapps can access. In the future there will be support for more granular access control using namespaces.

## <a name="install"></a>Installation
Install 3box in your npm project:
```
$ npm install 3box
```

## <a name="usage"></a>Usage
### Import 3Box into your project
Import the 3box module
```js
const Box = require('3box')
```
Import using the dist build in your html code
```js
<script type="text/javascript" src="../dist/3box.js"></script>
```

Or optionally by loading remote copy from [unpkg](https://unpkg.com/) CDN.

```html
<!-- The most recent version  -->
<script src="https://unpkg.com/3box/dist/3box.js"></script>
<!-- The most recent minified version  -->
<script src="https://unpkg.com/3box/dist/3box.min.js"></script>
<!-- Load specific versions by specifying the version as follows -->
<script src="https://unpkg.com/3box@<version>/dist/3box.js"></script>
```

### Get the public profile of an address
3Box allows users to create a public profile. In your dapp you might have multiple ethereum addresses that you would like to display a name and picture for. The `getProfile` method allows you to retrieve the profile of any ethereum address (if it has one). This is a *static* method so you can call it directly from the **Box** object.

Using `async/await`
```js
const profile = await Box.getProfile('0x12345abcde')
console.log(profile)
```
or using `.then`
```js
Box.getProfile('0x12345abcde').then(profile => {
  console.log(profile)
})
```

### Get, set, and remove data
To get or modify data in a user's 3Box, first open their 3Box by calling the openBox method. This method prompts the user to authenticate your dapp and returns a promise with a threeBox instance. You can only set, get, and remove data of users that are currently interacting with your dapp. Below `ethereumProvider` refers to the object that you would get from `web3.currentProvider`, or `window.ethereum`.

#### Open 3Box session
Using `async/await`
```js
const box = await Box.openBox('0x12345abcde', ethereumProvider)
```
or using `.then`
```js
Box.openBox('0x12345abcde', ethereumProvider).then(box => {
  // interact with 3Box data
})
```

#### Network sync
When you first open the box in your dapp all data might not be synced from the network yet. You should therefore add a listener using the `onSyncDone` method. This will allow you to know when all the users data is available to you. We advice against *setting* any data before this has happened.
```js
box.onSyncDone(yourCallbackFunction)
```


#### Interact with 3Box data
You can now use the `box` instance object to interact with data in the users private store and profile. In both the profile and the private store you use a `key` to set a `value`.

Using `async/await`
```js
// use the public profile
// get
const nickname = await box.public.get('name')
console.log(nickname)
// set
await box.public.set('name', 'oed')
// remove
await box.public.remove('name')

// use the private store
// get
const email = await box.private.get('email')
console.log(email)
// set
await box.private.set('email', 'oed@email.service')
// remove
await box.private.remove('email')
```
or using `.then`
```js
// use the public profile
// get
box.public.get('name').then(nickname => {
  console.log(nickname)
  // set
  box.public.set('name', 'oed').then(() => {
    // remove
    box.public.remove('name').then(() => {
    })
  })
})

// use the private store
// get
box.private.get('email').then(email => {
  console.log(email)
  // set
  box.private.set('email', 'oed@email.service').then(() => {
    // remove
    box.private.remove('email').then(() => {
    })
  })
})
```

#### IPFS Configs

Two options are available if you want to pass additional IPFS config options to the IPFS object used in the library.

First you can pass your own IPFS object, configured how you decide and then disable the iframe as well. This offers the most optionality but experiences a loss in performace without the iframe.

```js
const IPFS_OPTIONS = {
  EXPERIMENTAL: {
    pubsub: true
  },
  ... // Add your additional options, pubsub is required
}

const ipfs = new IPFS(IPFS_OPTIONS)
const box = await Box.openBox('0x12345abcde', ethereumProvider, { ipfs, iframeStore: false })
```

Second you can access the already initialized default IPFS object and change the IPFS configurations available after initialization. For example you can add a pinning node as follows.

```js
const box = await Box.openBox('0x12345abcde', ethereumProvider)

box._ipfs.swarm.connect(pinningNode, () => {
  ...
})
```

Reference [ipfs-js](https://github.com/ipfs/js-ipfs) for additional options.

## <a name="dappdata"></a> Dapp data
Dapps can store data about users that relate to only their dapp. However we encurage dapps to share data between them for a richer web3 experience. Therefore we have created [**Key Conventions**](./KEY-CONVENTIONS.md) in order to facilitate this. Feel free to make a PR to this file to explain to the community how you use 3Box!

## <a name="example"></a> Example

You can quickly run and interact with some code by looking at the files in the `/example` folder. You run the example with the following command:

```bash
$ npm run example:start
```

This runs a simple server at `http://localhost:3000/` that serves the static `example/index.html` file. This allows it easily interact with metamask. You can edit the `example/index.html` file to try differnt code.

## <a name="api"></a> API Documentation
<a name="Box"></a>

### Box
**Kind**: global class  

* [Box](#Box)
    * [new Box()](#new_Box_new)
    * _instance_
        * [.public](#Box+public)
        * [.private](#Box+private)
        * [.verified](#Box+verified)
        * [.onSyncDone(syncDone)](#Box+onSyncDone)
        * [.close()](#Box+close)
        * [.logout()](#Box+logout)
    * _static_
        * [.getProfile(address, opts)](#Box.getProfile) ⇒ <code>Object</code>
        * [.getProfiles(address, opts)](#Box.getProfiles) ⇒ <code>Object</code>
        * [.profileGraphQL(query, opts)](#Box.profileGraphQL) ⇒ <code>Object</code>
        * [.getVerifiedAccounts(profile)](#Box.getVerifiedAccounts) ⇒ <code>Object</code>
        * [.openBox(address, ethereumProvider, opts)](#Box.openBox) ⇒ [<code>Box</code>](#Box)
        * [.isLoggedIn(address)](#Box.isLoggedIn) ⇒ <code>Boolean</code>

<a name="new_Box_new"></a>

#### new Box()
Please use the **openBox** method to instantiate a 3Box

<a name="Box+public"></a>

#### box.public
**Kind**: instance property of [<code>Box</code>](#Box)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| public | [<code>KeyValueStore</code>](#KeyValueStore) | access the profile store of the users 3Box |

<a name="Box+private"></a>

#### box.private
**Kind**: instance property of [<code>Box</code>](#Box)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| private | [<code>KeyValueStore</code>](#KeyValueStore) | access the private store of the users 3Box |

<a name="Box+verified"></a>

#### box.verified
**Kind**: instance property of [<code>Box</code>](#Box)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| verified | [<code>Verifications</code>](#Verifications) | check and create verifications |

<a name="Box+onSyncDone"></a>

#### box.onSyncDone(syncDone)
Sets the callback function that will be called once when the db is fully synced.

**Kind**: instance method of [<code>Box</code>](#Box)  

| Param | Type | Description |
| --- | --- | --- |
| syncDone | <code>function</code> | The function that will be called |

<a name="Box+close"></a>

#### box.close()
Closes the 3box instance without clearing the local cache.
Should be called after you are done using the 3Box instance,
but without logging the user out.

**Kind**: instance method of [<code>Box</code>](#Box)  
<a name="Box+logout"></a>

#### box.logout()
Closes the 3box instance and clears local cache. If you call this,
users will need to sign a consent message to log in the next time
you call openBox.

**Kind**: instance method of [<code>Box</code>](#Box)  
<a name="Box.getProfile"></a>

#### Box.getProfile(address, opts) ⇒ <code>Object</code>
Get the public profile of a given address

**Kind**: static method of [<code>Box</code>](#Box)  
**Returns**: <code>Object</code> - a json object with the profile for the given address  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>String</code> | An ethereum address |
| opts | <code>Object</code> | Optional parameters |
| opts.addressServer | <code>String</code> | URL of the Address Server |
| opts.ipfs | <code>Object</code> | A js-ipfs ipfs object |
| opts.orbitPath | <code>String</code> | A custom path for orbitdb storage |
| opts.iframeStore | <code>Boolean</code> | Use iframe for storage, allows shared store across domains. Default true when run in browser. |
| opts.useCacheService | <code>Boolean</code> | Use 3Box API and Cache Service to fetch profile instead of OrbitDB. Default true. |

<a name="Box.getProfiles"></a>

#### Box.getProfiles(address, opts) ⇒ <code>Object</code>
Get a list of public profiles for given addresses. This relies on 3Box profile API.

**Kind**: static method of [<code>Box</code>](#Box)  
**Returns**: <code>Object</code> - a json object with each key an address and value the profile  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>Array</code> | An array of ethereum addresses |
| opts | <code>Object</code> | Optional parameters |
| opts.profileServer | <code>String</code> | URL of Profile API server |

<a name="Box.profileGraphQL"></a>

#### Box.profileGraphQL(query, opts) ⇒ <code>Object</code>
GraphQL for 3Box profile API

**Kind**: static method of [<code>Box</code>](#Box)  
**Returns**: <code>Object</code> - a json object with each key an address and value the profile  

| Param | Type | Description |
| --- | --- | --- |
| query | <code>Object</code> | A graphQL query object. |
| opts | <code>Object</code> | Optional parameters |
| opts.graphqlServer | <code>String</code> | URL of graphQL 3Box profile service |

<a name="Box.getVerifiedAccounts"></a>

#### Box.getVerifiedAccounts(profile) ⇒ <code>Object</code>
Verifies the proofs of social accounts that is present in the profile.

**Kind**: static method of [<code>Box</code>](#Box)  
**Returns**: <code>Object</code> - An object containing the accounts that have been verified  

| Param | Type | Description |
| --- | --- | --- |
| profile | <code>Object</code> | A user profile object |

<a name="Box.openBox"></a>

#### Box.openBox(address, ethereumProvider, opts) ⇒ [<code>Box</code>](#Box)
Opens the user space associated with the given address

**Kind**: static method of [<code>Box</code>](#Box)  
**Returns**: [<code>Box</code>](#Box) - the 3Box instance for the given address  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>String</code> | An ethereum address |
| ethereumProvider | <code>ethereumProvider</code> | An ethereum provider |
| opts | <code>Object</code> | Optional parameters |
| opts.consentCallback | <code>function</code> | A function that will be called when the user has consented to opening the box |
| opts.pinningNode | <code>String</code> | A string with an ipfs multi-address to a 3box pinning node |
| opts.ipfs | <code>Object</code> | A js-ipfs ipfs object |
| opts.orbitPath | <code>String</code> | A custom path for orbitdb storage |
| opts.addressServer | <code>String</code> | URL of the Address Server |
| opts.iframeStore | <code>Boolean</code> | Use iframe for storage, allows shared store across domains. Default true when run in browser. |

<a name="Box.isLoggedIn"></a>

#### Box.isLoggedIn(address) ⇒ <code>Boolean</code>
Check if the given address is logged in

**Kind**: static method of [<code>Box</code>](#Box)  
**Returns**: <code>Boolean</code> - true if the user is logged in  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>String</code> | An ethereum address |

<a name="KeyValueStore"></a>

### KeyValueStore
**Kind**: global class  

* [KeyValueStore](#KeyValueStore)
    * [new KeyValueStore()](#new_KeyValueStore_new)
    * [.log](#KeyValueStore+log) ⇒ <code>Array.&lt;Object&gt;</code>
    * [.get(key)](#KeyValueStore+get) ⇒ <code>String</code>
    * [.set(key, value)](#KeyValueStore+set) ⇒ <code>Boolean</code>
    * [.remove(key)](#KeyValueStore+remove) ⇒ <code>Boolean</code>

<a name="new_KeyValueStore_new"></a>

#### new KeyValueStore()
Please use **box.profileStore** or **box.profileStore** to get the instance of this class

<a name="KeyValueStore+log"></a>

#### keyValueStore.log ⇒ <code>Array.&lt;Object&gt;</code>
Returns array of underlying log entries. In linearized order according to their Lamport clocks.
Useful for generating a complete history of all operations on store.

**Kind**: instance property of [<code>KeyValueStore</code>](#KeyValueStore)  
**Returns**: <code>Array.&lt;Object&gt;</code> - Array of ordered log entry objects  
**Example**  
```js
const log = store.log
 const entry = log[0]
 console.log(entry)
 // { op: 'PUT', key: 'Name', value: 'Botbot', timeStamp: '1538575416068' }
```
<a name="KeyValueStore+get"></a>

#### keyValueStore.get(key) ⇒ <code>String</code>
Get the value of the given key

**Kind**: instance method of [<code>KeyValueStore</code>](#KeyValueStore)  
**Returns**: <code>String</code> - the value associated with the key  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | the key |

<a name="KeyValueStore+set"></a>

#### keyValueStore.set(key, value) ⇒ <code>Boolean</code>
Set a value for the given key

**Kind**: instance method of [<code>KeyValueStore</code>](#KeyValueStore)  
**Returns**: <code>Boolean</code> - true if successful  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | the key |
| value | <code>String</code> | the value |

<a name="KeyValueStore+remove"></a>

#### keyValueStore.remove(key) ⇒ <code>Boolean</code>
Remove the value for the given key

**Kind**: instance method of [<code>KeyValueStore</code>](#KeyValueStore)  
**Returns**: <code>Boolean</code> - true if successful  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | the key |

<a name="Verifications"></a>

### Verifications
**Kind**: global class  

* [Verifications](#Verifications)
    * [new Verifications()](#new_Verifications_new)
    * [.github()](#Verifications+github) ⇒ <code>Object</code>
    * [.addGithub(gistUrl)](#Verifications+addGithub) ⇒ <code>Object</code>
    * [.twitter()](#Verifications+twitter) ⇒ <code>Object</code>
    * [.addTwitter(claim)](#Verifications+addTwitter) ⇒ <code>Object</code>

<a name="new_Verifications_new"></a>

#### new Verifications()
Please use **box.verified** to get the instance of this class

<a name="Verifications+github"></a>

#### verifications.github() ⇒ <code>Object</code>
Verifies that the user has a valid github account
Throws an error otherwise.

**Kind**: instance method of [<code>Verifications</code>](#Verifications)  
**Returns**: <code>Object</code> - Object containing username, and proof  
<a name="Verifications+addGithub"></a>

#### verifications.addGithub(gistUrl) ⇒ <code>Object</code>
Adds a github verification to the users profile
Throws an error if the verification fails.

**Kind**: instance method of [<code>Verifications</code>](#Verifications)  
**Returns**: <code>Object</code> - Object containing username, and proof  

| Param | Type | Description |
| --- | --- | --- |
| gistUrl | <code>Object</code> | URL of the proof |

<a name="Verifications+twitter"></a>

#### verifications.twitter() ⇒ <code>Object</code>
Verifies that the user has a valid twitter account
Throws an error otherwise.

**Kind**: instance method of [<code>Verifications</code>](#Verifications)  
**Returns**: <code>Object</code> - Object containing username, proof, and the verifier  
<a name="Verifications+addTwitter"></a>

#### verifications.addTwitter(claim) ⇒ <code>Object</code>
Adds a twitter verification to the users profile
Throws an error if the verification fails.

**Kind**: instance method of [<code>Verifications</code>](#Verifications)  
**Returns**: <code>Object</code> - Object containing username, proof, and the verifier  

| Param | Type | Description |
| --- | --- | --- |
| claim | <code>String</code> | A did-JWT claim ownership of a twitter username |

