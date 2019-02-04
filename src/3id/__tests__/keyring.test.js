import Keyring from '../keyring'
import { HDNode } from 'ethers/utils'
import nacl from 'tweetnacl'
import naclUtil from 'tweetnacl-util'
nacl.util = naclUtil


describe('Keyring', () => {

  let keyring1
  let keyring2
  let keyring3
  const seed = HDNode.mnemonicToSeed('clay rubber drama brush salute cream nerve wear stuff sentence trade conduct')
  const publicKeys1 = {
    signingKey: '028aaa695fa16f2a2279e1de718d80e00f4f4ddf30fe8674bbdb9e1f11778c2f77',
    ethereumKey: '027422e4f0321f010fd6b763bac41db22dcbf3717c7a9762bd7d2b9ce302152060',
    asymEncryptionKey: 'wW1wkjQ7kaZiBvk4bhukQ15Idx6d31XKFpq/jeup5nc='
  }
  const signedData = {
    r: 'b1f9c552e21b40fe95c5d3074a4ef3948a092a77fc814781bf8ae3a263499e0a',
    s: 'a57bdeb64a1490c3e8877d2d6e0c0450a87b765d8bf6f541b65bbf3aac1926f2',
    recoveryParam: 1
  }
  //const keyring2 = new Keyring()
  //const keyring3 = new Keyring()

  it('throws error if no seed', async () => {
    expect(() => new Keyring()).toThrow()
  })

  it('derives correct keys from entropy', async () => {
    keyring2 = new Keyring('0xf0e4c2f76c58916ec258f246851bea091d14d4247a2fc3e18694461b1816e13b')
    keyring3 = new Keyring('0x24a0bc3a2a1d1404c0ab24bef9bb0618938ee892fbf62f63f82f015eddf1729e')
    expect(keyring2._seed).toEqual('0xf0e4c2f76c58916ec258f246851bea091d14d4247a2fc3e18694461b1816e13b')
  })

  it('derives correct keys from seed', async () => {
    keyring1 = new Keyring(seed)

    expect(keyring1.getPublicKeys()).toEqual(publicKeys1)
    expect(keyring1.serialize()).toEqual(seed)
  })

  it('getDBKey works correctly', async () => {
    const key = keyring1.getDBKey()
    expect(key.getPublic('hex')).toEqual('048aaa695fa16f2a2279e1de718d80e00f4f4ddf30fe8674bbdb9e1f11778c2f77f8ffb5ad2bd3f1f9840b3462c26f756ec0f47626894c20ed247145f5c0e26fe8')
  })

  it('signs data correctly', async () => {
    expect((await keyring1.getJWTSigner()('asdf'))).toEqual(signedData)
  })

  it('encrypts and decrypts correctly', () => {
    const testMsg = "Very secret test message"
    let box = keyring1.asymEncrypt(testMsg, keyring2.getPublicKeys().asymEncryptionKey)

    let cleartext = keyring2.asymDecrypt(box.ciphertext, keyring1.getPublicKeys().asymEncryptionKey, box.nonce)
    expect(cleartext).toEqual(testMsg)
  })

  it('symmetrically encrypts correctly', async () => {
    const testMsg = "Very secret test message"
    let box = keyring2.symEncrypt(testMsg)
    let cleartext = keyring2.symDecrypt(box.ciphertext, box.nonce)
    expect(cleartext).toEqual(testMsg)
  })
})
