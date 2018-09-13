# 3box-js

**Warning:** This project is under active development, APIs are subject to change.

This is a library which allows you to set, get, and remove private and public data associated with an ethereum account. It can be used to store identity data, user settings, etc. by dapps that use a web3 enabled browser. The data will be retrievable as long as the user has access to the private key for the used ethereum account. The data is encrypted and can not be read by any third party that the user hasn't authorized. Currently it supports one shared space which all dapps can access. In the future there will be support for more granular access control using namespaces.

[Data Schema](./DATA-MODEL.md)

## Installation
Install 3box in your npm project:
```
$ npm install 3box
```

## Usage
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
const threeBox = await ThreeBox.openBox('0x12345abcde', web3provider)
```
or using `.then`
```js
ThreeBox.openBox('0x12345abcde', web3provider).then(threeBox => {
  // interact with 3Box data
})
```

#### Interact with 3Box data
You can now use the `threeBox` instance object to interact with data in the users private store and profile. In both the profile and the private store you use a `key` to set a `value`. [**What keys can I use?**](./KEY-USAGE.md)

Using `async/await`
```js
// use the public profile
// get
const nickname = await threeBox.profileStore.get('name')
console.log(nickname)
// set
await threeBox.profileStore.set('name', 'oed')
// remove
await threeBox.profileStore.remove('name')

// use the private store
// get
const email = await threeBox.privateStore.get('email')
console.log(email)
// set
await threeBox.privateStore.set('email', 'oed@email.service')
// remove
await threeBox.privateStore.remove('email')
```
or using `.then`
```js
// use the public profile
// get
threeBox.profileStore.get('name').then(nickname => {
  console.log(nickname)
  // set
  threeBox.profileStore.set('name', 'oed').then(() => {
    // remove
    threeBox.profileStore.remove('name').then(() => {
    })
  })
})

// use the private store
// get
threeBox.privateStore.get('email').then(email => {
  console.log(email)
  // set
  threeBox.privateStore.set('email', 'oed@email.service').then(() => {
    // remove
    threeBox.privateStore.remove('email').then(() => {
    })
  })
})
```

# API Documentation

<a name="ThreeBox"></a>

## ThreeBox
**Kind**: global class  

* [ThreeBox](#ThreeBox)
    * [new ThreeBox()](#new_ThreeBox_new)
    * _instance_
        * [.profileStore](#ThreeBox+profileStore)
        * [.privateStore](#ThreeBox+privateStore)
        * [.close()](#ThreeBox+close)
        * [.logout()](#ThreeBox+logout)
    * _static_
        * [.getProfile(address, opts)](#ThreeBox.getProfile) ⇒ <code>Object</code>
        * [.openBox(address, web3provider, opts)](#ThreeBox.openBox) ⇒ [<code>ThreeBox</code>](#ThreeBox)

<a name="new_ThreeBox_new"></a>

### new ThreeBox()
Please use the **openBox** method to instantiate a ThreeBox

<a name="ThreeBox+profileStore"></a>

### threeBox.profileStore
**Kind**: instance property of [<code>ThreeBox</code>](#ThreeBox)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| profileStore | [<code>ProfileStore</code>](#ProfileStore) | access the profile store of the users threeBox |

<a name="ThreeBox+privateStore"></a>

### threeBox.privateStore
**Kind**: instance property of [<code>ThreeBox</code>](#ThreeBox)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| privateStore | [<code>PrivateStore</code>](#PrivateStore) | access the private store of the users threeBox |

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
Get the public profile of the given address

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
| opts.ipfs | <code>IPFS</code> | A custom ipfs instance |

<a name="PrivateStore"></a>

## PrivateStore
**Kind**: global class  

* [PrivateStore](#PrivateStore)
    * [new PrivateStore()](#new_PrivateStore_new)
    * [.get(key)](#PrivateStore+get) ⇒ <code>String</code>
    * [.set(key, value)](#PrivateStore+set) ⇒ <code>Boolean</code>
    * [.remove(key)](#PrivateStore+remove) ⇒ <code>Boolean</code>

<a name="new_PrivateStore_new"></a>

### new PrivateStore()
Please use **threeBox.privateStore** to get the instance of this class

<a name="PrivateStore+get"></a>

### privateStore.get(key) ⇒ <code>String</code>
Get the value of the given key

**Kind**: instance method of [<code>PrivateStore</code>](#PrivateStore)  
**Returns**: <code>String</code> - the value associated with the key  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | the key |

<a name="PrivateStore+set"></a>

### privateStore.set(key, value) ⇒ <code>Boolean</code>
Set a value for the given key

**Kind**: instance method of [<code>PrivateStore</code>](#PrivateStore)  
**Returns**: <code>Boolean</code> - true if successful  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | the key |
| value | <code>String</code> | the value |

<a name="PrivateStore+remove"></a>

### privateStore.remove(key) ⇒ <code>Boolean</code>
Remove the value for the given key

**Kind**: instance method of [<code>PrivateStore</code>](#PrivateStore)  
**Returns**: <code>Boolean</code> - true if successful  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | the key |

<a name="ProfileStore"></a>

## ProfileStore
**Kind**: global class  

* [ProfileStore](#ProfileStore)
    * [new ProfileStore()](#new_ProfileStore_new)
    * [.get(key)](#ProfileStore+get) ⇒ <code>String</code>
    * [.set(key, value)](#ProfileStore+set) ⇒ <code>Boolean</code>
    * [.remove(key)](#ProfileStore+remove) ⇒ <code>Boolean</code>

<a name="new_ProfileStore_new"></a>

### new ProfileStore()
Please use **threeBox.profileStore** to get the instance of this class

<a name="ProfileStore+get"></a>

### profileStore.get(key) ⇒ <code>String</code>
Get the value of the given key

**Kind**: instance method of [<code>ProfileStore</code>](#ProfileStore)  
**Returns**: <code>String</code> - the value associated with the key  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | the key |

<a name="ProfileStore+set"></a>

### profileStore.set(key, value) ⇒ <code>Boolean</code>
Set a value for the given key

**Kind**: instance method of [<code>ProfileStore</code>](#ProfileStore)  
**Returns**: <code>Boolean</code> - true if successful  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | the key |
| value | <code>String</code> | the value |

<a name="ProfileStore+remove"></a>

### profileStore.remove(key) ⇒ <code>Boolean</code>
Remove the value for the given key

**Kind**: instance method of [<code>ProfileStore</code>](#ProfileStore)  
**Returns**: <code>Boolean</code> - true if successful  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | the key |

