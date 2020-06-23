#!/usr/bin/env node

const Ipfs = require('ipfs')
const Replicator = require('../lib/replicator.js')

const start = async (address) => {
  console.log('\nOpening rootstore:\n', address)
  const ipfs = await Ipfs.create({ repo: `./tmp/ipfs/` })
  const opts = { orbitPath: './tmp/orbitdb/' }
  const replicator = await Replicator.create(ipfs, opts)
  console.log('starting')
  await replicator.start(address, null)//, { spacesList: ['clients'] })
  console.log('syncing')
  await replicator.rootstoreSyncDone
  console.log('rootstore synced')
  console.log(replicator.rootstore.all.map(e => {
    return e.payload.value
  }))
  //const store = await replicator._loadKeyValueStore('/orbitdb/QmXxg79y5akxNBB4WsY5oPS82PCxiU9WQbR1aK9aD7ieiH/3box.space.clients.keyvalue')
  //console.log('store:')
  //console.log(store._oplog.length)
  await replicator.syncDone
  console.log('all syned')
}

const rootstoreAddress = process.argv[2]
start(rootstoreAddress)
