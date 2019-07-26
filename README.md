[![CircleCI](https://img.shields.io/circleci/project/github/3box/3box-js.svg?style=for-the-badge)](https://circleci.com/gh/3box/3box-js)
[![Discord](https://img.shields.io/discord/484729862368526356.svg?style=for-the-badge)](https://discordapp.com/invite/Z3f3Cxy)
[![npm](https://img.shields.io/npm/dt/3box.svg?style=for-the-badge)](https://www.npmjs.com/package/3box)
[![npm](https://img.shields.io/npm/v/3box.svg?style=for-the-badge)](https://www.npmjs.com/package/3box)
[![Codecov](https://img.shields.io/codecov/c/github/3box/3box-js.svg?style=for-the-badge)](https://codecov.io/gh/3box/3box-js)
[![Twitter Follow](https://img.shields.io/twitter/follow/3boxdb.svg?style=for-the-badge&label=Twitter)](https://twitter.com/3boxdb)
[![Greenkeeper badge](https://badges.greenkeeper.io/3box/3box-js.svg)](https://greenkeeper.io/)

[Install](#install) | [Usage](#usage) | [Example](#example) | [Data Standards](#datastandards) | [API Docs](#api)

# 3box-js

This is a library which allows you to set, get, and remove private and public data associated with an ethereum account. It can be used to store identity data, user settings, etc. by dapps that use a web3 enabled browser. The data will be retrievable as long as the user has access to the private key for the used ethereum account. The data is encrypted and can not be read by any third party that the user hasn't authorized. There is one shared space for data which all authorized dapps access by default, then there are spaces which dapps have to request explicit consent to access.

## Getting Started
### <a name="install"></a>Installation
Install 3box in your npm project:
```
$ npm install 3box
```

### <a name="usage"></a>Usage
#### Import 3Box into your project
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

## Profiles API
### Get the existing public profile of an address (or DID)
3Box allows users to create a public profile for their Ethereum address. In your dapp you might have multiple ethereum addresses that you would like to display a name, image, and other basic social metadata for. The `getProfile` method allows you to fetch the public profile of any ethereum address (if it has one). This is a *static* method so you can call it directly from the **Box** object.

```js
const profile = await Box.getProfile('0x12345abcde')
console.log(profile)
```

### Update (get, set, remove) public and private profile data
3Box allows applications to create, read, update, and delete public and private data stored in a user's 3Box. To enable this functionality, applications must first open the user's 3Box by calling the openBox method. This method prompts the user to authenticate (sign-in) to your dapp and returns a promise with a threeBox instance. You can only update (set, get, remove) data for users that have authenticated to and are currently interacting with your dapp. Below `ethereumProvider` refers to the object that you would get from `web3.currentProvider`, or `window.ethereum`.

#### 1. Authenticate users to begin new 3Box session
Calling the openBox method will open a new 3Box session. If the user's ethereum address already has a 3Box account, your application will gain access to it. If the user does not have an existing 3Box account, this method will automatically create one for them in the background.
```js
const box = await Box.openBox('0x12345abcde', ethereumProvider)
```

#### 2. Sync user's available 3Box data from the network
When you first open the box in your dapp all data might not be synced from the network yet. You should therefore add a listener using the `onSyncDone` method. This will allow you to know when all the user's data is available to you. We advise against *setting* any data before this sync has happened. However, reading data before the sync is complete is fine and encouraged - just remember to check for updates once this callback is fired!
```js
box.onSyncDone(yourCallbackFunction)
```

#### 3. Interact with 3Box profile data
You can now use the `box` instance object to interact with public and private data stored in the user's profile. In both the public and the private data store you use a `key` to set a `value`.

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

##### Set multiple fields at once:
```js
const fields = ['name', 'website', 'employer']
const values = ['Jon Schwartz', 'openworklabs.com', 'Open Work Labs']

await box.public.setMultiple(fields, values)

const privateFields = ['age', 'coinBalance']
const privateValues = ['xxx', 'yyy']

await box.private.setMultiple(privateFields, privateValues)
```

<!-- commenting this out for now, not really needed when we're not using the iframe
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
-->

## Spaces API (Storage)
### Open a space
A space is a named section of a users 3Box. Each space has both a public and a private store, and for every space you open the user has to grant explicit consent to view that space. This means that if your dapp uses a space that no other dapp uses, only your dapp is allowed to update the data and read the private store of that particular space. To open a space called `narwhal` you simply call:

```js
const space = await box.openSpace('narwhal')
```

#### Get, set, and remove space data
Interacting with data in a space is done in the same way as interacting with `box.public` and `box.private` ([see here](#interact-with-3box-data)). For example:
```js
const config = await space.private.get('dapp-config')
```

## Threads API (Messaging)
### Add message threads to your app
Threads are a shared datastore that enable decentralized communication between users, by allowing one or more users to post messages in a sequence. This functionality is great for adding commenting, chat, messaging, feed, and stream features to your application. Threads are saved within a space and users that join a thread (with the same name, in the same space, and same moderation configs) will be able to communicate in that thread.

For the fully detailed spec, view the [documentation](https://github.com/3box/3box/blob/master/3IPs/3ip-2.md).

#### Viewing a Thread
You can get all posts made in a thread without opening a space. This is great for allowing visitors of your site view comments made by other users. This is achieved by calling the `getThread` method on the Box object. A thread can be referenced by all its configuration options or by its address.
```js
const posts = await Box.getThread(spaceName, threadName, firstModerator, membersThread)
console.log(posts)
```

```js
const posts = await Box.getThreadByAddress(threadAddress)
console.log(posts)
```
However if applications want to add interactivity to the thread, such as allowing the user to post in a thread or follow updates in a thread, you will need to open their space to enable additional functionality.

#### Interacting with a Thread

##### 1. Joining a thread
To post in a thread, a user must first join the thread. This will implicitly use the moderation options where the current user is the `firstModerator` and `members` is false.
```js
const thread = await space.joinThread('myThread')
```

A thread can also be given the moderation options when joining. You can pass `firstModerator`, a 3ID of the first moderator, and a `members` boolean which indicates if it is a members thread or not. Moderators can add other moderators, add members, and delete any posts in the thread. Members can post in member only threads.

```js
const thread = await space.joinThread('myThread', { firstModerator: 'some3ID', members: true })
```

Lastly a thread can be joined by its address.

```js
const thread = await space.joinThreadByAddress('/orbitdb/zdpuAp5QpBKR4BBVTvqe3KXVcNgo4z8Rkp9C5eK38iuEZj3jq/3box.thread.testSpace.testThread')
```

##### 2. Posting to a thread
This allows the user to add a message to the thread. The author of the message will be the user's 3Box DID. When a user posts in a thread, they are automatically subscribed to the thread and it is saved in the space used by the application under the key `thread-threadName`.
```js
await thread.post('hello world')
```
##### 3. Getting all posts in a thread
This allows applications to get the posts in a thread.
```js
const posts = await thread.getPosts()
console.log(posts)
```
##### 4. Listening for updates in thread
This allows applications to listen for new posts in the thread, and perform an action when this occurs, such as adding the new message to the application's UI.
```js
thread.onUpdate(myCallbackFunction)
```

##### 5. Handling moderation and capabilities

Add a moderator and list all existing moderators
```js
await thread.addModerator('some3ID')

const mods = await thread.listModerators()
```

Add a member and list all existing members, if a members only thread
```js
await thread.addMember('some3ID')

const members = await thread.listMembers()
```

Listen for when there has been moderators or member added.
```js
thread.onNewCapabilities(myCallbackFunction)
```

## <a name="example"></a> Example Application

You can quickly run and interact with some code by looking at the files in the `/example` folder. You run the example with the following command:

```bash
$ npm run example:start
```

This runs a simple server at `http://localhost:3000/` that serves the static `example/index.html` file. This allows it easily interact with metamask. You can edit the `example/index.html` file to try differnt code.

## Build

### Optimize build for read-only 3Box API

If you only want to fetch profile data from 3Box's profile APIs you can optimize by importing only those functions or the API specific dist file. Since this includes minimal dependencies, file size is ~ 80kb vs 4+mb for the full build.

```js
const { profileGraphQL, getProfile, getProfiles, getVerifiedAccounts } = require('3box/lib/api')
```
```html
<script src="https://unpkg.com/3box/dist/3box.api.min.js"></script>
```

### Resolving build size issues and out of memory errors

Some platforms, tooling, or configs have caused the build process to throw out of memory errors. This is a combination of the size of our library (plus dependencies) and the specific configs you have for your build. It could be things like tooling running on dependencies and not just your source or dependencies be recursively resolved. You can attempt to build the library anyways by adding the follow environment variable to increase memory for the node process.

```
NODE_OPTIONS=--max_old_space_size=4096 npm run build
```

## <a name="datastandards"></a> Data Standards
Dapps can store data about users that relate to only their dapp. However we encurage dapps to share data between them for a richer web3 experience. Therefore we have created [**Key Conventions**](https://github.com/3box/3box/blob/master/community/key-conventions.md) in order to facilitate this. Feel free to make a PR to this file to explain to the community how you use 3Box!

## <a nam="idUtils"></a> Validate claims
Use the `idUtils` module to [validate claims](https://www.w3.org/TR/verifiable-claims-data-model/). See
the [did-jwt](https://github.com/uport-project/did-jwt) library for more details.

```js
const { idUtils } = require('3box')

const claim = 'eyJ0eX...'
idUtils.verifyClaim(claim)
  .then(valid => console.info('details:', valid)
  .catch(err => console.error('claim verification failed:', err)
```

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
        * [.spaces](#Box+spaces)
        * [.DID](#Box+DID)
        * [.openSpace(name, opts)](#Box+openSpace) ⇒ [<code>Space</code>](#Space)
        * [.onSyncDone(syncDone)](#Box+onSyncDone)
        * [.linkAddress([link])](#Box+linkAddress)
        * [.removeAddressLink(address)](#Box+removeAddressLink)
        * [.isAddressLinked([query])](#Box+isAddressLinked)
        * [.listAddressLinks()](#Box+listAddressLinks) ⇒ <code>Array</code>
        * [.logout()](#Box+logout)
    * _static_
        * [.idUtils](#Box.idUtils)
            * [.verifyClaim](#Box.idUtils.verifyClaim) ⇒ <code>Object</code>
            * [.isMuportDID(address)](#Box.idUtils.isMuportDID) ⇒ <code>\*</code> \| <code>boolean</code>
            * [.isClaim(claim, opts)](#Box.idUtils.isClaim) ⇒ <code>Promise.&lt;boolean&gt;</code>
        * [.getProfile(address, opts)](#Box.getProfile) ⇒ <code>Object</code>
        * [.getProfiles(address, opts)](#Box.getProfiles) ⇒ <code>Object</code>
        * [.getSpace(address, name, opts)](#Box.getSpace) ⇒ <code>Object</code>
        * [.getThread(space, name, firstModerator, members, opts)](#Box.getThread) ⇒ <code>Array.&lt;Object&gt;</code>
        * [.getThreadByAddress(address, opts)](#Box.getThreadByAddress) ⇒ <code>Array.&lt;Object&gt;</code>
        * [.getConfig(address, opts)](#Box.getConfig) ⇒ <code>Array.&lt;Object&gt;</code>
        * [.listSpaces(address, opts)](#Box.listSpaces) ⇒ <code>Object</code>
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
| verified | [<code>Verified</code>](#Verified) | check and create verifications |

<a name="Box+spaces"></a>

#### box.spaces
**Kind**: instance property of [<code>Box</code>](#Box)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| spaces | <code>Object</code> | an object containing all open spaces indexed by their name. |

<a name="Box+DID"></a>

#### box.DID
**Kind**: instance property of [<code>Box</code>](#Box)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| DID | <code>String</code> | the DID of the user |

<a name="Box+openSpace"></a>

#### box.openSpace(name, opts) ⇒ [<code>Space</code>](#Space)
Opens the space with the given name in the users 3Box

**Kind**: instance method of [<code>Box</code>](#Box)  
**Returns**: [<code>Space</code>](#Space) - the Space instance for the given space name  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | The name of the space |
| opts | <code>Object</code> | Optional parameters |
| opts.consentCallback | <code>function</code> | A function that will be called when the user has consented to opening the box |
| opts.onSyncDone | <code>function</code> | A function that will be called when the space has finished syncing with the pinning node |

<a name="Box+onSyncDone"></a>

#### box.onSyncDone(syncDone)
Sets the callback function that will be called once when the db is fully synced.

**Kind**: instance method of [<code>Box</code>](#Box)  

| Param | Type | Description |
| --- | --- | --- |
| syncDone | <code>function</code> | The function that will be called |

<a name="Box+linkAddress"></a>

#### box.linkAddress([link])
Creates a proof that links an ethereum address to the 3Box account of the user. If given proof, it will simply be added to the root store.

**Kind**: instance method of [<code>Box</code>](#Box)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [link] | <code>Object</code> |  | Optional link object with type or proof |
| [link.type] | <code>String</code> | <code>&#x27;ethereum-eoa&#x27;</code> | The type of link (default 'ethereum') |
| [link.proof] | <code>Object</code> |  | Proof object, should follow [spec](https://github.com/3box/3box/blob/master/3IPs/3ip-5.md) |

<a name="Box+removeAddressLink"></a>

#### box.removeAddressLink(address)
Remove given address link, returns true if successful

**Kind**: instance method of [<code>Box</code>](#Box)  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>String</code> | address that is linked |

<a name="Box+isAddressLinked"></a>

#### box.isAddressLinked([query])
Checks if there is a proof that links an external account to the 3Box account of the user. If not params given and any link exists, returns true

**Kind**: instance method of [<code>Box</code>](#Box)  

| Param | Type | Description |
| --- | --- | --- |
| [query] | <code>Object</code> | Optional object with address and/or type. |
| [query.type] | <code>String</code> | Does the given type of link exist |
| [query.address] | <code>String</code> | Is the given adressed linked |

<a name="Box+listAddressLinks"></a>

#### box.listAddressLinks() ⇒ <code>Array</code>
Lists address links associated with this 3Box

**Kind**: instance method of [<code>Box</code>](#Box)  
**Returns**: <code>Array</code> - An array of link objects  
<a name="Box+logout"></a>

#### box.logout()
Closes the 3box instance and clears local cache. If you call this,
users will need to sign a consent message to log in the next time
you call openBox.

**Kind**: instance method of [<code>Box</code>](#Box)  
<a name="Box.idUtils"></a>

#### Box.idUtils
A module to verify & validate claims

**Kind**: static property of [<code>Box</code>](#Box)  

* [.idUtils](#Box.idUtils)
    * [.verifyClaim](#Box.idUtils.verifyClaim) ⇒ <code>Object</code>
    * [.isMuportDID(address)](#Box.idUtils.isMuportDID) ⇒ <code>\*</code> \| <code>boolean</code>
    * [.isClaim(claim, opts)](#Box.idUtils.isClaim) ⇒ <code>Promise.&lt;boolean&gt;</code>

<a name="Box.idUtils.verifyClaim"></a>

##### idUtils.verifyClaim ⇒ <code>Object</code>
Verify a claim and return its content.
See https://github.com/uport-project/did-jwt/ for more details.

**Kind**: static property of [<code>idUtils</code>](#Box.idUtils)  
**Returns**: <code>Object</code> - The validated claim  

| Param | Type | Description |
| --- | --- | --- |
| claim | <code>String</code> |  |
| opts | <code>Object</code> | Optional parameters |
| opts.audience | <code>string</code> | The DID of the JWT's audience |

<a name="Box.idUtils.isMuportDID"></a>

##### idUtils.isMuportDID(address) ⇒ <code>\*</code> \| <code>boolean</code>
Check whether a string is a muport did or not

**Kind**: static method of [<code>idUtils</code>](#Box.idUtils)  
**Returns**: <code>\*</code> \| <code>boolean</code> - Whether the address is a muport did or not  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>String</code> | A string containing a user profile address |

<a name="Box.idUtils.isClaim"></a>

##### idUtils.isClaim(claim, opts) ⇒ <code>Promise.&lt;boolean&gt;</code>
Check whether a string is a valid claim or not

**Kind**: static method of [<code>idUtils</code>](#Box.idUtils)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - whether the parameter is an actual claim  

| Param | Type | Description |
| --- | --- | --- |
| claim | <code>String</code> |  |
| opts | <code>Object</code> | Optional parameters |
| opts.audience | <code>string</code> | The DID of the audience of the JWT |

<a name="Box.getProfile"></a>

#### Box.getProfile(address, opts) ⇒ <code>Object</code>
Get the public profile of a given address

**Kind**: static method of [<code>Box</code>](#Box)  
**Returns**: <code>Object</code> - a json object with the profile for the given address  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>String</code> | An ethereum address |
| opts | <code>Object</code> | Optional parameters |
| opts.blocklist | <code>function</code> | A function that takes an address and returns true if the user has been blocked |
| opts.metadata | <code>String</code> | flag to retrieve metadata |
| opts.addressServer | <code>String</code> | URL of the Address Server |
| opts.ipfs | <code>Object</code> | A js-ipfs ipfs object |
| opts.useCacheService | <code>Boolean</code> | Use 3Box API and Cache Service to fetch profile instead of OrbitDB. Default true. |
| opts.profileServer | <code>String</code> | URL of Profile API server |

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

<a name="Box.getSpace"></a>

#### Box.getSpace(address, name, opts) ⇒ <code>Object</code>
Get the public data in a space of a given address with the given name

**Kind**: static method of [<code>Box</code>](#Box)  
**Returns**: <code>Object</code> - a json object with the public space data  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>String</code> | An ethereum address |
| name | <code>String</code> | A space name |
| opts | <code>Object</code> | Optional parameters |
| opts.blocklist | <code>function</code> | A function that takes an address and returns true if the user has been blocked |
| opts.metadata | <code>String</code> | flag to retrieve metadata |
| opts.profileServer | <code>String</code> | URL of Profile API server |

<a name="Box.getThread"></a>

#### Box.getThread(space, name, firstModerator, members, opts) ⇒ <code>Array.&lt;Object&gt;</code>
Get all posts that are made to a thread.

**Kind**: static method of [<code>Box</code>](#Box)  
**Returns**: <code>Array.&lt;Object&gt;</code> - An array of posts  

| Param | Type | Description |
| --- | --- | --- |
| space | <code>String</code> | The name of the space the thread is in |
| name | <code>String</code> | The name of the thread |
| firstModerator | <code>String</code> | The DID (or ethereum address) of the first moderator |
| members | <code>Boolean</code> | True if only members are allowed to post |
| opts | <code>Object</code> | Optional parameters |
| opts.profileServer | <code>String</code> | URL of Profile API server |

<a name="Box.getThreadByAddress"></a>

#### Box.getThreadByAddress(address, opts) ⇒ <code>Array.&lt;Object&gt;</code>
Get all posts that are made to a thread.

**Kind**: static method of [<code>Box</code>](#Box)  
**Returns**: <code>Array.&lt;Object&gt;</code> - An array of posts  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>String</code> | The orbitdb-address of the thread |
| opts | <code>Object</code> | Optional parameters |
| opts.profileServer | <code>String</code> | URL of Profile API server |

<a name="Box.getConfig"></a>

#### Box.getConfig(address, opts) ⇒ <code>Array.&lt;Object&gt;</code>
Get the configuration of a users 3Box

**Kind**: static method of [<code>Box</code>](#Box)  
**Returns**: <code>Array.&lt;Object&gt;</code> - An array of posts  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>String</code> | The ethereum address |
| opts | <code>Object</code> | Optional parameters |
| opts.profileServer | <code>String</code> | URL of Profile API server |

<a name="Box.listSpaces"></a>

#### Box.listSpaces(address, opts) ⇒ <code>Object</code>
Get the names of all spaces a user has

**Kind**: static method of [<code>Box</code>](#Box)  
**Returns**: <code>Object</code> - an array with all spaces as strings  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>String</code> | An ethereum address |
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
| profile | <code>Object</code> | A user profile object, received from the `getProfile` function |

<a name="Box.openBox"></a>

#### Box.openBox(address, ethereumProvider, opts) ⇒ [<code>Box</code>](#Box)
Opens the 3Box associated with the given address

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
| opts.addressServer | <code>String</code> | URL of the Address Server |
| opts.contentSignature | <code>String</code> | A signature, provided by a client of 3box using the private keys associated with the given address, of the 3box consent message |

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
    * [.get(key, opts)](#KeyValueStore+get) ⇒ <code>String</code> \| <code>Object</code>
    * [.getMetadata(key)](#KeyValueStore+getMetadata) ⇒ <code>Metadata</code>
    * [.set(key, value)](#KeyValueStore+set) ⇒ <code>Boolean</code>
    * [.setMultiple(keys, values)](#KeyValueStore+setMultiple) ⇒ <code>Boolean</code>
    * [.remove(key)](#KeyValueStore+remove) ⇒ <code>Boolean</code>
    * [.all(opts)](#KeyValueStore+all) ⇒ <code>Array.&lt;(String\|{value: String, timestamp: Number})&gt;</code>

<a name="new_KeyValueStore_new"></a>

#### new KeyValueStore()
Please use **box.public** or **box.private** to get the instance of this class

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

#### keyValueStore.get(key, opts) ⇒ <code>String</code> \| <code>Object</code>
Get the value and optionally metadata of the given key

**Kind**: instance method of [<code>KeyValueStore</code>](#KeyValueStore)  
**Returns**: <code>String</code> \| <code>Object</code> - the value associated with the key, undefined if there's no such key  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | the key |
| opts | <code>Object</code> | optional parameters |
| opts.metadata | <code>Boolean</code> | return both value and metadata |

<a name="KeyValueStore+getMetadata"></a>

#### keyValueStore.getMetadata(key) ⇒ <code>Metadata</code>
Get metadata for for a given key

**Kind**: instance method of [<code>KeyValueStore</code>](#KeyValueStore)  
**Returns**: <code>Metadata</code> - Metadata for the key, undefined if there's no such key  

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

<a name="KeyValueStore+setMultiple"></a>

#### keyValueStore.setMultiple(keys, values) ⇒ <code>Boolean</code>
Set multiple values for multiple keys

**Kind**: instance method of [<code>KeyValueStore</code>](#KeyValueStore)  
**Returns**: <code>Boolean</code> - true if successful, throw error if not  

| Param | Type | Description |
| --- | --- | --- |
| keys | <code>Array.&lt;String&gt;</code> | the keys |
| values | <code>Array.&lt;String&gt;</code> | the values |

<a name="KeyValueStore+remove"></a>

#### keyValueStore.remove(key) ⇒ <code>Boolean</code>
Remove the value for the given key

**Kind**: instance method of [<code>KeyValueStore</code>](#KeyValueStore)  
**Returns**: <code>Boolean</code> - true if successful  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | the key |

<a name="KeyValueStore+all"></a>

#### keyValueStore.all(opts) ⇒ <code>Array.&lt;(String\|{value: String, timestamp: Number})&gt;</code>
Get all values and optionally metadata

**Kind**: instance method of [<code>KeyValueStore</code>](#KeyValueStore)  
**Returns**: <code>Array.&lt;(String\|{value: String, timestamp: Number})&gt;</code> - the values  

| Param | Type | Description |
| --- | --- | --- |
| opts | <code>Object</code> | optional parameters |
| opts.metadata | <code>Boolean</code> | return both values and metadata |

<a name="Space"></a>

### Space
**Kind**: global class  

* [Space](#Space)
    * [new Space()](#new_Space_new)
    * [.public](#Space+public)
    * [.private](#Space+private)
    * [.DID](#Space+DID)
    * [.joinThread(name, opts)](#Space+joinThread) ⇒ [<code>Thread</code>](#Thread)
    * [.joinThreadByAddress(address, opts)](#Space+joinThreadByAddress) ⇒ [<code>Thread</code>](#Thread)
    * [.subscribeThread(address, config)](#Space+subscribeThread)
    * [.unsubscribeThread(address)](#Space+unsubscribeThread)
    * [.subscribedThreads()](#Space+subscribedThreads) ⇒ <code>Array.&lt;Objects&gt;</code>

<a name="new_Space_new"></a>

#### new Space()
Please use **box.openSpace** to get the instance of this class

<a name="Space+public"></a>

#### space.public
**Kind**: instance property of [<code>Space</code>](#Space)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| public | [<code>KeyValueStore</code>](#KeyValueStore) | access the profile store of the space |

<a name="Space+private"></a>

#### space.private
**Kind**: instance property of [<code>Space</code>](#Space)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| private | [<code>KeyValueStore</code>](#KeyValueStore) | access the private store of the space |

<a name="Space+DID"></a>

#### space.DID
**Kind**: instance property of [<code>Space</code>](#Space)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| DID | <code>String</code> | the did of the user in this space |

<a name="Space+joinThread"></a>

#### space.joinThread(name, opts) ⇒ [<code>Thread</code>](#Thread)
Join a thread. Use this to start receiving updates from, and to post in threads

**Kind**: instance method of [<code>Space</code>](#Space)  
**Returns**: [<code>Thread</code>](#Thread) - An instance of the thread class for the joined thread  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | The name of the thread |
| opts | <code>Object</code> | Optional parameters |
| opts.firstModerator | <code>String</code> | DID of first moderator of a thread, by default, user is first moderator |
| opts.members | <code>Boolean</code> | join a members only thread, which only members can post in, defaults to open thread |
| opts.noAutoSub | <code>Boolean</code> | Disable auto subscription to the thread when posting to it (default false) |

<a name="Space+joinThreadByAddress"></a>

#### space.joinThreadByAddress(address, opts) ⇒ [<code>Thread</code>](#Thread)
Join a thread by full thread address. Use this to start receiving updates from, and to post in threads

**Kind**: instance method of [<code>Space</code>](#Space)  
**Returns**: [<code>Thread</code>](#Thread) - An instance of the thread class for the joined thread  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>String</code> | The full address of the thread |
| opts | <code>Object</code> | Optional parameters |
| opts.noAutoSub | <code>Boolean</code> | Disable auto subscription to the thread when posting to it (default false) |

<a name="Space+subscribeThread"></a>

#### space.subscribeThread(address, config)
Subscribe to the given thread, if not already subscribed

**Kind**: instance method of [<code>Space</code>](#Space)  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>String</code> | The address of the thread |
| config | <code>Object</code> | configuration and thread meta data |
| opts.name | <code>String</code> | Name of thread |
| opts.firstModerator | <code>String</code> | DID of the first moderator |
| opts.members | <code>String</code> | Boolean string, true if a members only thread |

<a name="Space+unsubscribeThread"></a>

#### space.unsubscribeThread(address)
Unsubscribe from the given thread, if subscribed

**Kind**: instance method of [<code>Space</code>](#Space)  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>String</code> | The address of the thread |

<a name="Space+subscribedThreads"></a>

#### space.subscribedThreads() ⇒ <code>Array.&lt;Objects&gt;</code>
Get a list of all the threads subscribed to in this space

**Kind**: instance method of [<code>Space</code>](#Space)  
**Returns**: <code>Array.&lt;Objects&gt;</code> - A list of thread objects as { address, firstModerator, members, name}  
<a name="Thread"></a>

### Thread
**Kind**: global class  

* [Thread](#Thread)
    * [new Thread()](#new_Thread_new)
    * [.post(message)](#Thread+post) ⇒ <code>String</code>
    * [.addModerator(id)](#Thread+addModerator)
    * [.listModerators()](#Thread+listModerators) ⇒ <code>Array.&lt;String&gt;</code>
    * [.addMember(id)](#Thread+addMember)
    * [.listMembers()](#Thread+listMembers) ⇒ <code>Array.&lt;String&gt;</code>
    * [.deletePost(id)](#Thread+deletePost)
    * [.getPosts(opts)](#Thread+getPosts) ⇒ <code>Array.&lt;Object&gt;</code>
    * [.onUpdate(updateFn)](#Thread+onUpdate)
    * [.onNewCapabilities(updateFn)](#Thread+onNewCapabilities)

<a name="new_Thread_new"></a>

#### new Thread()
Please use **space.joinThread** to get the instance of this class

<a name="Thread+post"></a>

#### thread.post(message) ⇒ <code>String</code>
Post a message to the thread

**Kind**: instance method of [<code>Thread</code>](#Thread)  
**Returns**: <code>String</code> - The postId of the new post  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>Object</code> | The message |

<a name="Thread+addModerator"></a>

#### thread.addModerator(id)
Add a moderator to this thread, throws error is user can not add a moderator

**Kind**: instance method of [<code>Thread</code>](#Thread)  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>String</code> | Moderator Id |

<a name="Thread+listModerators"></a>

#### thread.listModerators() ⇒ <code>Array.&lt;String&gt;</code>
List moderators

**Kind**: instance method of [<code>Thread</code>](#Thread)  
**Returns**: <code>Array.&lt;String&gt;</code> - Array of moderator DIDs  
<a name="Thread+addMember"></a>

#### thread.addMember(id)
Add a member to this thread, throws if user can not add member, throw is not member thread

**Kind**: instance method of [<code>Thread</code>](#Thread)  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>String</code> | Member Id |

<a name="Thread+listMembers"></a>

#### thread.listMembers() ⇒ <code>Array.&lt;String&gt;</code>
List members, throws if not member thread

**Kind**: instance method of [<code>Thread</code>](#Thread)  
**Returns**: <code>Array.&lt;String&gt;</code> - Array of member DIDs  
<a name="Thread+deletePost"></a>

#### thread.deletePost(id)
Delete post

**Kind**: instance method of [<code>Thread</code>](#Thread)  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>String</code> | Moderator Id |

<a name="Thread+getPosts"></a>

#### thread.getPosts(opts) ⇒ <code>Array.&lt;Object&gt;</code>
Returns an array of posts, based on the options.
If hash not found when passing gt, gte, lt, or lte,
the iterator will return all items (respecting limit and reverse).

**Kind**: instance method of [<code>Thread</code>](#Thread)  
**Returns**: <code>Array.&lt;Object&gt;</code> - true if successful  

| Param | Type | Description |
| --- | --- | --- |
| opts | <code>Object</code> | Optional parameters |
| opts.gt | <code>String</code> | Greater than, takes an postId |
| opts.gte | <code>String</code> | Greater than or equal to, takes an postId |
| opts.lt | <code>String</code> | Less than, takes an postId |
| opts.lte | <code>String</code> | Less than or equal to, takes an postId |
| opts.limit | <code>Integer</code> | Limiting the number of entries in result, defaults to -1 (no limit) |
| opts.reverse | <code>Boolean</code> | If set to true will result in reversing the result |

<a name="Thread+onUpdate"></a>

#### thread.onUpdate(updateFn)
Register a function to be called after new updates
have been received from the network or locally.

**Kind**: instance method of [<code>Thread</code>](#Thread)  

| Param | Type | Description |
| --- | --- | --- |
| updateFn | <code>function</code> | The function that will get called |

<a name="Thread+onNewCapabilities"></a>

#### thread.onNewCapabilities(updateFn)
Register a function to be called for every new
capability that is added to the thread access controller.
This inlcudes when a moderator or member is added.
The function takes one parameter, which is the capabilities obj, or
you can call listModerator / listMembers again instead.

**Kind**: instance method of [<code>Thread</code>](#Thread)  

| Param | Type | Description |
| --- | --- | --- |
| updateFn | <code>function</code> | The function that will get called |

<a name="Verified"></a>

### Verified
**Kind**: global class  

* [Verified](#Verified)
    * [new Verified()](#new_Verified_new)
    * [.DID()](#Verified+DID) ⇒ <code>String</code>
    * [.github()](#Verified+github) ⇒ <code>Object</code>
    * [.addGithub(gistUrl)](#Verified+addGithub) ⇒ <code>Object</code>
    * [.twitter()](#Verified+twitter) ⇒ <code>Object</code>
    * [.addTwitter(claim)](#Verified+addTwitter) ⇒ <code>Object</code>
    * [.email()](#Verified+email) ⇒ <code>Object</code>
    * [.addEmail(claim)](#Verified+addEmail) ⇒ <code>Object</code>

<a name="new_Verified_new"></a>

#### new Verified()
Please use **box.verified** to get the instance of this class

<a name="Verified+DID"></a>

#### verified.DID() ⇒ <code>String</code>
Returns the verified DID of the user

**Kind**: instance method of [<code>Verified</code>](#Verified)  
**Returns**: <code>String</code> - The DID of the user  
<a name="Verified+github"></a>

#### verified.github() ⇒ <code>Object</code>
Verifies that the user has a valid github account
Throws an error otherwise.

**Kind**: instance method of [<code>Verified</code>](#Verified)  
**Returns**: <code>Object</code> - Object containing username, and proof  
<a name="Verified+addGithub"></a>

#### verified.addGithub(gistUrl) ⇒ <code>Object</code>
Adds a github verification to the users profile
Throws an error if the verification fails.

**Kind**: instance method of [<code>Verified</code>](#Verified)  
**Returns**: <code>Object</code> - Object containing username, and proof  

| Param | Type | Description |
| --- | --- | --- |
| gistUrl | <code>Object</code> | URL of the proof |

<a name="Verified+twitter"></a>

#### verified.twitter() ⇒ <code>Object</code>
Verifies that the user has a valid twitter account
Throws an error otherwise.

**Kind**: instance method of [<code>Verified</code>](#Verified)  
**Returns**: <code>Object</code> - Object containing username, proof, and the verifier  
<a name="Verified+addTwitter"></a>

#### verified.addTwitter(claim) ⇒ <code>Object</code>
Adds a twitter verification to the users profile
Throws an error if the verification fails.

**Kind**: instance method of [<code>Verified</code>](#Verified)  
**Returns**: <code>Object</code> - Object containing username, proof, and the verifier  

| Param | Type | Description |
| --- | --- | --- |
| claim | <code>String</code> | A did-JWT claim ownership of a twitter username |

<a name="Verified+email"></a>

#### verified.email() ⇒ <code>Object</code>
Verifies that the user has a verified email account
Throws an error otherwise.

**Kind**: instance method of [<code>Verified</code>](#Verified)  
**Returns**: <code>Object</code> - Object containing username, proof, and the verifier  
<a name="Verified+addEmail"></a>

#### verified.addEmail(claim) ⇒ <code>Object</code>
Adds an email verification to the users profile
Throws an error if the verification fails.

**Kind**: instance method of [<code>Verified</code>](#Verified)  
**Returns**: <code>Object</code> - Object containing username, proof, and the verifier  

| Param | Type | Description |
| --- | --- | --- |
| claim | <code>String</code> | A did-JWT claim ownership of an email username |

