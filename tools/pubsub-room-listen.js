#!/usr/bin/env node

const Ipfs = require('ipfs')
const Pubsub = require('orbit-db-pubsub')
const multiaddr = require('multiaddr')
const { pinning_node } = require('../lib/config.js')

const start = async (room) => {
  console.log('\nOpening pubsub room:\n', room)
  const ipfs = await Ipfs.create({ repo: `./tmp/ipfs/` })
  const pubsub = new Pubsub(ipfs, (await ipfs.id()).id)
  console.log('Connecting to pinning node')
  await ipfs.swarm.connect(multiaddr(pinning_node))
  console.log('Connected')

  pubsub.subscribe(room, (topic, data) => {
     console.log('message', topic, data)
  }, (topic, peer) => {
     console.log('peer', topic, peer)
  })
  console.log('Subscribed')
}

const room = process.argv[2]
start(room)
