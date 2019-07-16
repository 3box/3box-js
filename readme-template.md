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
