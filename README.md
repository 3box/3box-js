[![CircleCI](https://img.shields.io/circleci/project/github/uport-project/3box-js.svg?style=for-the-badge)](https://circleci.com/gh/uport-project/3box-js)
[![Discord](https://img.shields.io/discord/484729862368526356.svg?style=for-the-badge)](https://discordapp.com/invite/Z3f3Cxy)
[![npm](https://img.shields.io/npm/dt/3box.svg?style=for-the-badge)](https://www.npmjs.com/package/3box)
[![npm](https://img.shields.io/npm/v/3box.svg?style=for-the-badge)](https://www.npmjs.com/package/3box)
[![Codecov](https://img.shields.io/codecov/c/github/uport-project/3box-js.svg?style=for-the-badge)](https://codecov.io/gh/uport-project/3box-js)
[![Twitter Follow](https://img.shields.io/twitter/follow/3boxdb.svg?style=for-the-badge&label=Twitter)](https://twitter.com/3boxdb)

[Install](#install) | [Usage](#usage) | [Example](#example) | [API Docs](#api)

# 3box-js

**Warning:** This project is under active development, APIs are subject to change.

This is a library which allows you to set, get, and remove private and public data associated with an ethereum account. It can be used to store identity data, user settings, etc. by dapps that use a web3 enabled browser. The data will be retrievable as long as the user has access to the private key for the used ethereum account. The data is encrypted and can not be read by any third party that the user hasn't authorized. Currently it supports one shared space which all dapps can access. In the future there will be support for more granular access control using namespaces.

## <a name="install"></a>Installation
Install 3box in your npm project:
```
$ npm install 3box@next
```

## <a name="usage"></a>Usage
### Import 3Box into your project
Import the 3box module
```js
const ThreeBox = require('3box')
```
or use the dist build in your html code
```js
<script type="text/javascript" src="../dist/3box.js"></script>
```

### Get the public profile of an address
3Box allows users to create a public profile. In your dapp you might have multiple ethereum addresses that you would like to display a name and picture for. The `getProfile` method allows you to retrieve the profile of any ethereum address (if it has one). This is a *static* method so you can call it directly from the **ThreeBox** object.

Using `async/await`
```js
const profile = await ThreeBox.getProfile('0x12345abcde')
console.log(profile)
```
or using `.then`
```js
ThreeBox.getProfile('0x12345abcde').then(profile => {
  console.log(profile)
})
```

### Get, set, and remove data
To get or modify data in a user's 3Box, first open their 3Box by calling the openBox method. This method prompts the user to authenticate your dapp and returns a promise with a threeBox instance. You can only set, get, and remove data of users that are currently interacting with your dapp. Below `web3provider` refers to the object that you would get from `web3.currentProvider`, or request directly from the web3 browser, e.g. MetaMask.

#### Open 3Box session
Using `async/await`
```js
const box = await ThreeBox.openBox('0x12345abcde', web3provider)
```
or using `.then`
```js
ThreeBox.openBox('0x12345abcde', web3provider).then(box => {
  // interact with 3Box data
})
```

#### Interact with 3Box data
You can now use the `box` instance object to interact with data in the users private store and profile. In both the profile and the private store you use a `key` to set a `value`. [**What keys can I use?**](./KEY-USAGE.md)

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

# <a name="example"></a> Example

You can quickly run and interact with some code by looking at the files in the `/example` folder. You run the example with the following command:

```bash
$ npm run example:start
```

This runs a simple server at `http://localhost:3000/` that serves the static `example/index.html` file. This allows it easily interact with metamask. You can edit the `example/index.html` file to try differnt code.

# <a name="api"></a> API Documentation
<a name="ThreeBox"></a>

## ThreeBox
**Kind**: global class  

* [ThreeBox](#ThreeBox)
    * [new ThreeBox()](#new_ThreeBox_new)
    * _instance_
        * [.public](#ThreeBox+public)
        * [.private](#ThreeBox+private)
        * [.close()](#ThreeBox+close)
        * [.logout()](#ThreeBox+logout)
    * _static_
        * [.getProfile(address, opts)](#ThreeBox.getProfile) ⇒ <code>Object</code>
        * [.openBox(address, web3provider, opts)](#ThreeBox.openBox) ⇒ [<code>ThreeBox</code>](#ThreeBox)

<a name="new_ThreeBox_new"></a>

### new ThreeBox()
Please use the **openBox** method to instantiate a ThreeBox

<a name="ThreeBox+public"></a>

### threeBox.public
**Kind**: instance property of [<code>ThreeBox</code>](#ThreeBox)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| public | [<code>KeyValueStore</code>](#KeyValueStore) | access the profile store of the users threeBox |

<a name="ThreeBox+private"></a>

### threeBox.private
**Kind**: instance property of [<code>ThreeBox</code>](#ThreeBox)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| private | [<code>KeyValueStore</code>](#KeyValueStore) | access the private store of the users threeBox |

<a name="ThreeBox+close"></a>

### threeBox.close()
Closes the 3box instance without clearing the local cache.
Should be called after you are done using the 3Box instance,
but without logging the user out.

**Kind**: instance method of [<code>ThreeBox</code>](#ThreeBox)  
<a name="ThreeBox+logout"></a>

### threeBox.logout()
Closes the 3box instance and clears local cache. If you call this,
users will need to sign a consent message to log in the next time
you call openBox.

**Kind**: instance method of [<code>ThreeBox</code>](#ThreeBox)  
<a name="ThreeBox.getProfile"></a>

### ThreeBox.getProfile(address, opts) ⇒ <code>Object</code>
Get the public profile of a given address

**Kind**: static method of [<code>ThreeBox</code>](#ThreeBox)  
**Returns**: <code>Object</code> - a json object with the profile for the given address  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>String</code> | an ethereum address |
| opts | <code>Object</code> | Optional parameters |
| opts.ipfs | <code>IPFS</code> | A custom ipfs instance |

<a name="ThreeBox.openBox"></a>

### ThreeBox.openBox(address, web3provider, opts) ⇒ [<code>ThreeBox</code>](#ThreeBox)
Opens the user space associated with the given address

**Kind**: static method of [<code>ThreeBox</code>](#ThreeBox)  
**Returns**: [<code>ThreeBox</code>](#ThreeBox) - the threeBox instance for the given address  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>String</code> | an ethereum address |
| web3provider | <code>Web3Provider</code> | A Web3 provider |
| opts | <code>Object</code> | Optional parameters |
| opts.ipfsOptions | <code>Object</code> | A ipfs options object to pass to the js-ipfs constructor |
| opts.orbitPath | <code>String</code> | A custom path for orbitdb storage |
| opts.consentCallback | <code>function</code> | A function that will be called when the user has consented to opening the box |

<a name="KeyValueStore"></a>

## KeyValueStore
**Kind**: global class  

* [KeyValueStore](#KeyValueStore)
    * [new KeyValueStore()](#new_KeyValueStore_new)
    * [.log](#KeyValueStore+log) ⇒ <code>Array.&lt;Object&gt;</code>
    * [.get(key)](#KeyValueStore+get) ⇒ <code>String</code>
    * [.set(key, value)](#KeyValueStore+set) ⇒ <code>Boolean</code>
    * [.remove(key)](#KeyValueStore+remove) ⇒ <code>Boolean</code>

<a name="new_KeyValueStore_new"></a>

### new KeyValueStore()
Please use **threeBox.profileStore** or **threeBox.profileStore** to get the instance of this class

<a name="KeyValueStore+log"></a>

### keyValueStore.log ⇒ <code>Array.&lt;Object&gt;</code>
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

### keyValueStore.get(key) ⇒ <code>String</code>
Get the value of the given key

**Kind**: instance method of [<code>KeyValueStore</code>](#KeyValueStore)  
**Returns**: <code>String</code> - the value associated with the key  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | the key |

<a name="KeyValueStore+set"></a>

### keyValueStore.set(key, value) ⇒ <code>Boolean</code>
Set a value for the given key

**Kind**: instance method of [<code>KeyValueStore</code>](#KeyValueStore)  
**Returns**: <code>Boolean</code> - true if successful  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | the key |
| value | <code>String</code> | the value |

<a name="KeyValueStore+remove"></a>

### keyValueStore.remove(key) ⇒ <code>Boolean</code>
Remove the value for the given key

**Kind**: instance method of [<code>KeyValueStore</code>](#KeyValueStore)  
**Returns**: <code>Boolean</code> - true if successful  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | the key |

