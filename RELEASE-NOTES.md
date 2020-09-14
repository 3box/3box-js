# Release Notes

## v1.22.0 - 2020-09-14

* chore: upgrade orbit-db@0.25.1
* fix: logout, clean up prior login state
* chore: deprecate isLoggedIn, simply call auth, will return existing user if available
* fix: another datastore path, resolves "key not found error"

## v1.21.0 - 2020-08-06

* feat: shared ipfs and orbitdb iframe cache for faster auth/openbox and syncs
* fix: ledger support

## v1.20.3 - 2020-07-13
This release upgrades ipfs to 0.46.0, adds a fix that may allow some older accounts to be loaded/synced again, and downgrades libp2p-pubsub as temporary fix for connect/gossipsub errors.

* fix: timeout adress links which dont resolve ipfs.dag.get
* chore: up ipfs 0.46.0
* fix: downgrade libp2p-pubsub, 0.4.7 throwing error

## v1.20.2 - 2020-07-09
Fixes getting verified accounts (getVerifiedAccounts)

* fix: pass correct ipfs mock to resolve did

## v1.20.1 - 2020-06-23
* fix: bump libp2p-pubsub

## v1.20.0 - 2020-06-15
This release brings new IPFS features/performance in 0.44.0, and decreases bundled size by 1mb. Based on feedback from our first 3ID-Connect release, this brings a new more lightweight version and refactor. With these changes you need to pass a provider (as before) when creating or authenticating. The function get3idConnectProvider() is no longer available, when passing a provider we create a 3ID-Connect provider in the background. The recommended way to initialize a session is now as follows.

```
// On page load create
const box = await Box.create()
// Later authenticate user
const spaces = ['myDapp']
await box.auth(spaces, { address: '0x12345abcde', provider: ethProvider })
```

* feat: default to 3ID-Connect, pass an eth provider and 3id-connect will be created in background
* feat: supported function for browser feature support detection
* ref: pass a provider at box.auth instead of Box.create, so create can be called on page load.
* chore: upgrade to ipfs 0.44.0, libp2p-webrtc
* feat: ghostpinbot pass address
* ref: link address on auth

## v1.19.0 - 2020-05-12
* chore: upgrade did-jwt and did resolver libraries

## v1.18.1 - 2020-04-21
* fix: address recover signature check

## v1.18.0 - 2020-04-21
* feat: opt in support for [3ID Connect Provider](https://github.com/3box/3id-connect)
* fix: confidential threads support with IdentityWallet

Get a 3ID Connect Provider by calling Box.get3idConnectProvider()

## v1.17.1 - 2020-02-20
* fix: Use authereum signing key (#733)

## v1.17.0 - 2020-02-13
* feat: confidential threads 🔒📫

Confidential threads are encrypted member only threads, used for private dms, group messages, etc

## v1.16.3 - 2020-02-13
* fix: getIPFS called same time or from different closures in browser
* fix: ghost chat member list, with no auth opens

## v1.16.2 - 2020-02-05
* chore: update ipfs & orbitdb
* fix: Verify legacy muport DID properly
* fix: Special signature request for authereum
* ref: Send DID in all pin requests where possible

## v1.16.1 - 2020-01-13
fix: set fixed cache paths, so cache read/writes from same path and local data loaded

## v1.16.0 - 2020-01-10
This release brings a few performance updates as well as minor features in preparation for the upcoming Confidential Threads feature.

---
* feat: support for asymmetric encryption in spaces
* feat: fully migrate to 3ID, no more references to legacy "muport" DID
* chore: update OrbitDB for improved performance
* fix: IdentityWallet now works in a browser context
* fix: issue with using ghost threads while not authenticated resolved
* fix: linkAddress now works as expected with externally provided proof

## v1.15.0 - 2019-12-13
This release features a new interface for how to create and authenticate to a 3Box, it also adds the ability to open a thread before being authenticated to a space.

---
* feat: new initialization interface
* fix: add postId to ghost chat messages
* fix: don't allow space names with dots

## v1.14.0 - 2019-12-02
* feat: Support IdentityWallet v1.0.0 🎉
* chore: use ethers v5

* fix: add 'latest' parameter to `get_code` call (note: this was moved to the 3id-blockchain-utils package)

## v1.13.2 - 2019-11-15
* fix: check for 3id provider support in a better way

## v1.13.1 - 2019-10-25
* feat: return all messages seen in a ghost thread on getPost
* feat: add filters to ghost threads
* fix: issue with window being referenced in node.js
* fix: disconnect from pinning-room when finished

## v1.13.0 - 2019-10-18
**IdentityWallet v0.2.0** has support for a JSON-RPC provider interface. This release makes use of this interface, which allows wallets to connect to 3box in more ways.

---
* feat: added support for 3ID JSON-RPC Provider

## v1.12.0 - 2019-10-04
This release contains a feature called Ghost Threads. These threads are not persisted by in any way except in memory between users. Ghost Threads uses ipfs pubsub to send messages between peers, so in addition we have added a websocket signaling server to make peers discover each other easier. Ghost Threads includes a backlog for users that just joined, this is sent by already connected users that have a copy of recent messages.

---
* feat: added Ghost Threads
* feat: enabled websocket signaling server
* fix: small docs and dependency improvements

## v1.11.0 - 2019-09-24
* feat: 3box instance can now be created with an instance of the IdentityWallet
* feat: smarter data syncing logic
* feat: support erc1271 address links (your contract wallet can now have a 3Box!)
* feat: verify link proofs added by the `linkAddress` method

* fix: sync rootstore before resolving promise from openBox

### Updated data sync api
To wait for the data to be fully synced from the network you can now simply await these publicly exposed promises:
* `await box.syncDone` - for the main data storage
* `await space.syncDone` - for data in the given space

## v1.10.10 - 2019-09-12
* feat: add method to get ipfs instance without openBox

## v1.10.9 - 2019-09-10
* fix: allow multiple tab connections (support)

## v1.10.8 - 2019-08-22
* fix: ensureConnected consume db adddress, reconnect

## v1.10.7 - 2019-08-17
* fix: listAddressLinks now returns all links correctly
* fix: linkAddress now sends link to address-server

## v1.10.6 - 2019-08-13
* fix: Correctly encode DIDs on api calls

## v1.10.5 - 2019-08-02
* fix: made onSyncDone logic more robust

## v1.10.4 - 2019-07-31
* fix: solved issue with joining multiple threads

## v1.10.3 - 2019-07-26
* fix: resolves issue with portis and fortmatic web3 providers

## v1.10.2 - 2019-07-25
* feat: allow `consentSignature` to be passed as an option to `openBox`

## v1.10.1 - 2019-07-23
* fix: support usage of multiple tabs without data loss

## v1.10.0 - 2019-07-17
* feat: added ability to link multiple ethereum addresses to a 3Box
* feat: added ability to add a link proof manually
* feat: address links are now stored in the rootstore instead of the public profile
* feat: added getter for DID
* fix: support web3 1.0 providers

## v1.9.1 - 2019-06-19
* feat: allow joinThread, addModerator, addMember to take both ethereum addresses or DIDs as function argument
* ref: await linkProfile, throw error if not completed
* ref: linkAccount -> linkAdress and isAccountLinked -> isAddressLinked (orignal functions deprecated)

## v1.9.0 - 2019-06-11
* feat: add support for moderated and members threads
* feat: update to latest orbitdb and ipfs
* feat: add 3ID

Along with support for moderated and members threads, this replaces experimental threads seen in prior releases. Look for API changes to use new version of threads.

Also with the upgrade of OrbitDB, an upgrade of this library is required for everything to continue working as expected. More details here - https://medium.com/3box/3box-js-1-9-soft-fork-upgrade-bcd79bb5f29c

## v1.8.5 - 2019-05-30
* Fix: Return promise in public set/remove methods of spaces

## v1.8.4 - 2019-05-30
* Fix: Actually link profile when opening space and haven't used public store (fix bug from v1.8.2)

## v1.8.3 - 2019-05-24
* Fix: functions in the api module now work without an opts object being passed

## v1.8.2 - 2019-05-21
* Fix: Link profile when opening space and haven't used public store
* Feat: Add the ability to manually check and add account linking

## v1.8.1 - 2019-05-16
* Fix: Resolved issue with `getVerifiedAccounts` returning an empty objec

## v1.8.0 - 2019-05-09
* Feature: Add `setMultiple` method, enables multiple fields to be set at once.

Special thanks to @Schwartz10 for contributing this feature!

## v1.7.2 - 2019-04-30
* Fix: Don't allow setting values wihtout a 'key'
* Fix: Ensure that linkProfile only happens once
* Fix: Import keys in correct format

## v1.7.1 - 2019-04-25
* Fix: Throw error on openSpace if user denies consent
* Fix: Return correct timestamp format in metadata
* Docs: Updated documentation for idUtils, and added better general api description

## v1.7.0 - 2019-04-12
* Feature: Add ability to get metadata for entries
* Feature: Add idUtils helper functions
* Feature: Send along DID when opening db with pinning node

## v1.6.2 - 2019-04-09
* Fix: Use correct key when subscribing to thread in a space.

## v1.6.1 - 2019-03-29
* Fix: Add elliptic library to dependencies

## v1.6.0 - 2019-03-28
* Feature: Experimental support for threads
* Feature: Add support for DIDs in getProfile and getSpace
* Fix: Handle errors in getProfile correctly
* Fix: Better logic for linking profile to ethereum address

## v1.5.1 - 2019-03-20
* Fix for profiles/stores in Trustwallet, now expected stores will be created and loaded

## v1.5.0 - 2019-03-12
* Add support for getting public space data
* Add support for listing spaces of a user
* Properly format ETH-RPC calls

## v1.4.0 - 2019-02-21
* New functions for adding a verified email credential

## v1.3.0 - 2019-02-05
* Spaces feature, allows dapps to request access to compartments of the users 3Box which only dapps which the user has given explicit permission to can read/write
* 3Box is now able to run completely offline
* Added a more lightweight module for accessing getProfile and related api methods
* Updates to network logic for stability

## v1.2.2 - 2019-01-25
* Fixes a bug where more entries locally compared to the pinning node would result in onSyncDone not getting called.

## v1.2.1 - 2019-01-17
* Fixes bug in getVerifiedAccounts to work with earlier accounts #258
* Fix to allow openBox to be called with no options
* Replace bip39 dependency with more lightweight ethers.js dependency
* Removes stale lib files during build
* Modify example to work in additional environments including github pages

## v1.2.0 - 2019-01-08
* Implemented new "verified" api that checks and verifies various claims
* Reconnects to pinning node if connection is lost
* Disabled local cache iframe because it caused inconsistent behaviour
* Simplified syncing logic
* Fixed bug in getProfile #248

## v1.1.0 - 2018-12-27
### Features
* Local cache using an iframe
  IPFS and OrbitDB data is now shared between dapps. The data is now stored in an iframe instead of being replicated between each dapp.
* Network cache
  When syncing public profiles of users a centralized caching service is now used by default. This speeds up the process of getting multiple public profiles at once. This feature can be disabled in favor for the decentralized approach.
* GraphQL queries
  It's now possible to encode GraphQL queries for public profiles. This allows for queries of only the relevant information of profiles.
* Ethereum address proof
  The proof that links users ethereum address to their 3Box profile is now stored in their 3Box.

## v1.0.6 - 2018-12-4
Improve error handling
Publish DID in public profile
Doc fixes and cleanup

Bug fixes:
* running getProfile in node
* libp2p bootstrap config errors

## v1.0.5 - 2018-11-14
Added example for getProfile
Some bug fixes:
* getProfile can now handle mixed case addresses
* getProfile now connects to the pinning node directly

## v1.0.4 - 2018-11-05
Fixed dependency bug build

## v1.0.3 - 2018-10-25
Fixed bug in getProfile

## v1.0.2 - 2018-10-25
Fixed bug where private data was disappearing after being added.

## v1.0.1 - 2018-10-24
Change dist name output ThreeBox -> Box to match export name

## v1.0.0 - 2018-10-24
The first official release of 3box!
