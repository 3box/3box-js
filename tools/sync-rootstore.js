#!/usr/bin/env node

const Ipfs = require('ipfs')
const Replicator = require('../lib/replicator.js')

const start = async (address) => {
  console.log('\nOpening rootstore:\n', address)
  const ipfs = await Ipfs.create({ repo: `./tmp/ipfs/` })
  const opts = { orbitPath: './tmp/orbitdb/' }
  const replicator = await Replicator.create(ipfs, opts)
  console.log('starting')
  await replicator.start(address)
  console.log('syncing')
  await replicator.rootstoreSyncDone
  console.log('rootstore synced')
  console.log(replicator.rootstore._oplog.length)
  await replicator.syncDone
  console.log('all syned')
}

const rootstoreAddress = process.argv[2]
start(rootstoreAddress)
