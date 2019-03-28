[![CircleCI](https://img.shields.io/circleci/project/github/3box/3box-js.svg?style=for-the-badge)](https://circleci.com/gh/3box/3box-js)
[![Discord](https://img.shields.io/discord/484729862368526356.svg?style=for-the-badge)](https://discordapp.com/invite/Z3f3Cxy)
[![npm](https://img.shields.io/npm/dt/3box.svg?style=for-the-badge)](https://www.npmjs.com/package/3box)
[![npm](https://img.shields.io/npm/v/3box.svg?style=for-the-badge)](https://www.npmjs.com/package/3box)
[![Codecov](https://img.shields.io/codecov/c/github/uport-project/3box-js.svg?style=for-the-badge)](https://codecov.io/gh/uport-project/3box-js)
[![Twitter Follow](https://img.shields.io/twitter/follow/3boxdb.svg?style=for-the-badge&label=Twitter)](https://twitter.com/3boxdb)
[![Greenkeeper badge](https://badges.greenkeeper.io/3box/3box-js.svg)](https://greenkeeper.io/)

[Install](#install) | [Usage](#usage) | [Dapp data](#dappdata) | [Example](#example) | [API Docs](#api)

# 3box-js

This is a library which allows you to set, get, and remove private and public data associated with an ethereum account. It can be used to store identity data, user settings, etc. by dapps that use a web3 enabled browser. The data will be retrievable as long as the user has access to the private key for the used ethereum account. The data is encrypted and can not be read by any third party that the user hasn't authorized. There is one shared space for data which all authorized dapps access by default, then there are spaces which dapps have to request explicit consent to access.

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

```js
const profile = await Box.getProfile('0x12345abcde')
console.log(profile)
```

### Get, set, and remove data
To get or modify data in a user's 3Box, first open their 3Box by calling the openBox method. This method prompts the user to authenticate your dapp and returns a promise with a threeBox instance. You can only set, get, and remove data of users that are currently interacting with your dapp. Below `ethereumProvider` refers to the object that you would get from `web3.currentProvider`, or `window.ethereum`.

#### Open 3Box session
```js
const box = await Box.openBox('0x12345abcde', ethereumProvider)
```

#### Network sync
When you first open the box in your dapp all data might not be synced from the network yet. You should therefore add a listener using the `onSyncDone` method. This will allow you to know when all the users data is available to you. We advice against *setting* any data before this has happened. However reading data before is fine and encurraged, just remember to check for updates once this callback is fired!
```js
box.onSyncDone(yourCallbackFunction)
```


#### Interact with 3Box profile data
You can now use the `box` instance object to interact with data in the users private and public data. In both the public and the private data store you use a `key` to set a `value`.

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

### Using threads
**WARNING: this is an experimental feature, the api will likely change in the future!**
Threads are a type of datastore that can be used to communicate between users. For example they could be used to implement a commenting system, among other things. Threads are created within a space and users that join a thread with the same name will be able to communicate.
#### Joining a thread
```js
const thread = await space.joinThread('myThread')
```
#### Posting to thread
```js
await thread.post('hello world')
```
#### Getting all posts in a thread
```js
const posts = await thread.getPosts()
console.log(posts)
```
#### Listening for updates in thread
```js
thread.onNewPost(myCallbackFunction)
```

#### Get all posts in a thread without a space instance
You can get all posts made in a thread without opening a space.
```js
const posts = await Box.getThread(spaceName, threadName)
console.log(posts)
```


## <a name="dappdata"></a> Dapp data
Dapps can store data about users that relate to only their dapp. However we encurage dapps to share data between them for a richer web3 experience. Therefore we have created [**Key Conventions**](https://github.com/3box/3box/blob/master/community/key-conventions.md) in order to facilitate this. Feel free to make a PR to this file to explain to the community how you use 3Box!

## <a name="example"></a> Example

You can quickly run and interact with some code by looking at the files in the `/example` folder. You run the example with the following command:

```bash
$ npm run example:start
```

This runs a simple server at `http://localhost:3000/` that serves the static `example/index.html` file. This allows it easily interact with metamask. You can edit the `example/index.html` file to try differnt code.

## <a name="dappdata"></a> Optimize build for read only 3Box API

If you only want to fetch profile data from 3Box's profile APIs you can optimize by importing only those functions or the API specific dist file. Since this includes minimal dependencies, file size is ~ 80kb vs 4+mb for the full build.

```js
const { profileGraphQL, getProfile, getProfiles, getVerifiedAccounts } = require('3box/lib/api')
```
```html
<script src="https://unpkg.com/3box/dist/3box.api.min.js"></script>
```

## <a name="api"></a> API Documentation

