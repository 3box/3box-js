# Release Notes

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
