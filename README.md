# 3box-js

**Warning:** This project is under active development, APIs are subject to change.

This is a library which allows you to set, get, and remove private and public data associated with an ethereum account. It can be used to store identity data, user settings, etc. by dapps that use a web3 enabled browser. The data will be retrievable as long as the user has access to the private key for the used ethereum account. The data is encrypted and can not be read by any third party that the user hasn't authorized. Currently it supports one shared space which all dapps can access. In the future there will be support for more granular access control using namespaces.

[Data Schema](./DATA-MODEL.md)

[API Documentation](./API-SPECIFICATION.md)

## Usage
Simply install using npm
```
$ npm install 3box
```
and then import into your project
```js
const ThreeBox = require('3box')

ThreeBox.openBox(web3.eth.accounts[0]).then(threeBox => {
  // Code goes here...
})
```

## Classes

<dl>
<dt><a href="#ThreeBox">ThreeBox</a></dt>
<dd></dd>
<dt><a href="#PrivateStore">PrivateStore</a></dt>
<dd></dd>
<dt><a href="#ProfileStore">ProfileStore</a></dt>
<dd></dd>
</dl>

<a name="ThreeBox"></a>

## ThreeBox
**Kind**: global class  

* [ThreeBox](#ThreeBox)
    * [new ThreeBox(muportDID, web3provider, opts)](#new_ThreeBox_new)
    * _instance_
        * [.profileStore](#ThreeBox+profileStore)
        * [.privateStore](#ThreeBox+privateStore)
        * [.close()](#ThreeBox+close)
        * [.logout()](#ThreeBox+logout)
    * _static_
        * [.getProfile(address, opts)](#ThreeBox.getProfile) ⇒ <code>Object</code>
        * [.openBox(address, web3provider, opts)](#ThreeBox.openBox) ⇒ [<code>ThreeBox</code>](#ThreeBox)

<a name="new_ThreeBox_new"></a>

### new ThreeBox(muportDID, web3provider, opts)
Instantiates a threeBox

**Returns**: [<code>ThreeBox</code>](#ThreeBox) - self  

| Param | Type | Description |
| --- | --- | --- |
| muportDID | <code>MuPort</code> | A MuPort DID instance |
| web3provider | <code>Web3Provider</code> | A Web3 provider |
| opts | <code>Object</code> | Optional parameters |
| opts.ipfs | <code>IPFS</code> | A custom ipfs instance |
| opts.hashServer | <code>String</code> | A url to a custom hash server |

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
    * [new PrivateStore(muportDID, ipfs, updateRoot)](#new_PrivateStore_new)
    * [.get(key)](#PrivateStore+get) ⇒ <code>String</code>
    * [.set(key, value)](#PrivateStore+set) ⇒ <code>Boolean</code>
    * [.remove(key)](#PrivateStore+remove) ⇒ <code>Boolean</code>
    * [._sync(hash)](#PrivateStore+_sync)

<a name="new_PrivateStore_new"></a>

### new PrivateStore(muportDID, ipfs, updateRoot)
Instantiates a PrivateStore

**Returns**: [<code>PrivateStore</code>](#PrivateStore) - self  

| Param | Type | Description |
| --- | --- | --- |
| muportDID | <code>MuPort</code> | A MuPort DID instance |
| ipfs | <code>IPFS</code> | An instance of the ipfs api |
| updateRoot | <code>function</code> | A callback function that is called when the store has been updated |

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

<a name="PrivateStore+_sync"></a>

### privateStore._sync(hash)
Sync the private store with the given ipfs hash

**Kind**: instance method of [<code>PrivateStore</code>](#PrivateStore)  

| Param | Type | Description |
| --- | --- | --- |
| hash | <code>String</code> | The hash of the private store OrbitDB |

<a name="ProfileStore"></a>

## ProfileStore
**Kind**: global class  

* [ProfileStore](#ProfileStore)
    * [new ProfileStore(ipfs, updateRoot)](#new_ProfileStore_new)
    * [.get(key)](#ProfileStore+get) ⇒ <code>String</code>
    * [.set(key, value)](#ProfileStore+set) ⇒ <code>Boolean</code>
    * [.remove(key)](#ProfileStore+remove) ⇒ <code>Boolean</code>
    * [._uploadProfile()](#ProfileStore+_uploadProfile) ⇒ <code>Boolean</code>
    * [._sync(hash)](#ProfileStore+_sync)

<a name="new_ProfileStore_new"></a>

### new ProfileStore(ipfs, updateRoot)
Instantiates a ProfileStore

**Returns**: [<code>ProfileStore</code>](#ProfileStore) - self  

| Param | Type | Description |
| --- | --- | --- |
| ipfs | <code>IPFS</code> | An instance of the ipfs api |
| updateRoot | <code>function</code> | A callback function that is called when the store has been updated |

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

<a name="ProfileStore+_uploadProfile"></a>

### profileStore._uploadProfile() ⇒ <code>Boolean</code>
Upload the instanced profile to IPFS

**Kind**: instance method of [<code>ProfileStore</code>](#ProfileStore)  
**Returns**: <code>Boolean</code> - true if successful  
<a name="ProfileStore+_sync"></a>

### profileStore._sync(hash)
Sync the profile store with the given ipfs hash

**Kind**: instance method of [<code>ProfileStore</code>](#ProfileStore)  

| Param | Type | Description |
| --- | --- | --- |
| hash | <code>String</code> | The hash of the profile object |

