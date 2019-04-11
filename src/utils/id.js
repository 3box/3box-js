const DID_MUPORT_PREFIX = 'did:muport:'

module.exports = {
  isMuportDID: (address) => address.startsWith(DID_MUPORT_PREFIX),
}