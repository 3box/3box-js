const OrbitdbKeyStore = require('../orbitdbKeyAdapter')

const muportMockInstance = {
  keyring: {
    signingKey: {
      _hdkey: {
        _privateKey: Buffer.from('f917ac6883f88798a8ce39821fa523f2acd17c0ba80c724f219367e76d8f2c46', 'hex')
      }
    }
  }
}

describe('OrbitdbKeyStore', () => {
  let ks

  beforeAll(async () => {
    ks = new OrbitdbKeyStore(muportMockInstance)
  })

  it('should return a key that can sign and verify data', async () => {
    const k = ks.getKey()

    const sig = await ks.sign(k, 'very message, such sign')
    expect(await ks.verify(sig, k, 'very fail, such wrong')).toEqual(false)
    expect(await ks.verify(sig, k, 'very message, such sign')).toEqual(true)
  })

  it('getKey and createKey should return the same key', async () => {
    let k1 = ks.createKey()
    let k2 = ks.getKey()
    expect(k1).toEqual(k2)
  })
})
