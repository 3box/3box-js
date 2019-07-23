# Release Notes

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
