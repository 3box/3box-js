
it.skip('asdf', () => {})


  //it.skip('should open correctly and not add to rootStore if entry already present', async () => {
    //// TODO - this can be used in replicator tests
    //rootstoreMockData = [{ payload: { value: { type: 'space', odbAddress: '/orbitdb/Qmasofgh/3box.space.' + NAME2 + '.keyvalue'} } }]
    //let opts = {
      //consentCallback: jest.fn(),
    //}
    //const syncDonePromise = new Promise((resolve, reject) => {
      //opts.onSyncDone = resolve
    //})
    //authenticated = true
    //space = new Space(NAME2, replicatorMock, threeIdMock)
    //await space.open(opts)
    //expect(opts.consentCallback).toHaveBeenCalledWith(false, NAME2)
    //expect(rootstoreMock.add).toHaveBeenCalledTimes(0)
    //expect(threeIdMock.isAuthenticated).toHaveBeenCalledWith([NAME2])
    //await syncDonePromise
  //})

  //it.skip('should open correctly and add to rootStore if old entry already present', async () => {
    //rootstoreMockData = [{ hash: 'a hash', payload: { value: { odbAddress: '/orbitdb/Qmasofgh/3box.space.' + NAME2 + '.keyvalue'} } }]
    //let opts = {
      //consentCallback: jest.fn(),
    //}
    //const syncDonePromise = new Promise((resolve, reject) => {
      //opts.onSyncDone = resolve
    //})
    //space = new Space(NAME2, replicatorMock, threeIdMock)
    //await space.open(opts)
    //expect(opts.consentCallback).toHaveBeenCalledWith(false, NAME2)
    //expect(rootstoreMock.add).toHaveBeenCalledWith({ type: 'space', DID: threeIdMock.getSubDID(NAME2), odbAddress:'/orbitdb/myodbaddr' })
    //expect(rootstoreMock.del).toHaveBeenCalledWith('a hash')
    //expect(threeIdMock.isAuthenticated).toHaveBeenCalledWith([NAME2])
    //await syncDonePromise
  //})

  //it.skip('ensurePinningNodeConnected should not do anything if already connected to given pubsub room', async () => {
    //// TODO - can't get this test to work. Not sure what changed.
    //// Anyway the 3box client thinks it's connected to the ipfs node
    //// in the test, while the test thinks it's not connected to the client
    //const publishPromise = new Promise((resolve, reject) => {
      //pubsub.subscribe('3box-pinning', (topic, data) => {
        //expect(data.odbAddress).toEqual('/orbitdb/QmdmiLpbTca1bbYaTHkfdomVNUNK4Yvn4U1nTCYfJwy6Pn/b932fe7ab.root')
        //resolve()
      //}, () => {})
    //})
    //const peers = (await ipfs.swarm.peers())// [0].addr
    //await Promise.all(peers.map(async peer => {
      //await ipfs.swarm.disconnect(peer.addr)
    //}))
    //expect((await ipfs.swarm.peers()).length).toEqual(0)
    //await box._ensurePinningNodeConnected('non existant pubsub room')
    //await publishPromise
    //expect((await ipfs.swarm.peers()).length).toEqual(1)
    //pubsub.unsubscribe('3box-pinning')
  //})

    //const publishPromise = new Promise((resolve, reject) => {
      //pubsub.subscribe('3box-pinning', (topic, data) => {
        //expect(data.odbAddress).toEqual(box._rootStore.address.toString())
        //resolve()
      //}, () => {})
    //})

    //await publishPromise

    //const syncPromise = new Promise((resolve, reject) => { box.onSyncDone(resolve) })
    //pubsub.publish('3box-pinning', { type: 'HAS_ENTRIES', odbAddress: '/orbitdb/Qmasdf/08a7.public', numEntries: 4 })
    //pubsub.publish('3box-pinning', { type: 'HAS_ENTRIES', odbAddress: '/orbitdb/Qmfdsa/08a7.private', numEntries: 5 })
    //const rootStoreAddress = box._rootStore.address.toString()
    //pubsub.publish('3box-pinning', { type: 'HAS_ENTRIES', odbAddress: rootStoreAddress, numEntries: 0 })
    //await syncPromise
