const { isMuportDID } = require('../utils/id')

describe('basic utils tests', () => {
  test('is muport did', () => {
    expect(isMuportDID('abc')).toEqual(false)
    expect(isMuportDID('did:example')).toEqual(false)
    expect(isMuportDID('did:muport')).toEqual(false)
    expect(isMuportDID('did:muport:Qmb9E8wLqjfAqfKhideoApU5g26Yz2Q2bSp6MSZmc5WrNr')).toEqual(true)
  })

  test('isClaim', () => {

  })

  test('verifyClaim', () => {

  })
})