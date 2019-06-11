const { isMuportDID, isClaim, verifyClaim } = require('../utils/id')

const CLAIM_1 = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJpYXQiOjE1NTQ5NzI2MDksImV4cCI6MTk1NzQ2MzQyMSwibmFtZSI6InVQb3J0IERldmVsb3BlciIsImlzcyI6ImRpZDp1cG9ydDoyb3NuZko0V3k3TEJBbTJuUEJYaXJlMVdmUW43NVJyVjZUcyJ9.e9H1ngK7Kto_Am3N9NAJWm8kj7NetGPbOoQtKw8y-C21ytj1zjDr99w63AtlFCytYkLRcHnTHSl0eByaZww5dg'
const INVALID_CLAIM_FORMAT = '%eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJpYXQiOjE1NTQ5NzI2MDksImV4cCI6MTk1NzQ2MzQyMSwibmFtZSI6InVQb3J0IERldmVsb3BlciIsImlzcyI6ImRpZDp1cG9ydDoyb3NuZko0V3k3TEJBbTJuUEJYaXJlMVdmUW43NVJyVjZUcyJ9.e9H1ngK7Kto_Am3N9NAJWm8kj7NetGPbOoQtKw8y-C21ytj1zjDr99w63AtlFCytYkLRcHnTHSl0eByaZww5dg'
const EXPIRED_CLAIM = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJpYXQiOjE1NTQ5NzM5NDgsImV4cCI6MTk1LCJuYW1lIjoidVBvcnQgRGV2ZWxvcGVyIiwiaXNzIjoiZGlkOnVwb3J0OjJvc25mSjRXeTdMQkFtMm5QQlhpcmUxV2ZRbjc1UnJWNlRzIn0.M_HupDVb7N4TFOUg4B_PU6XQm9TTx7S0klhMLT1U3zfpThA4DAT2L8HGeBDTMuGS3-nXVo8oDYORASEX_ecGsQ'

describe('basic utils tests', () => {
  test('is muport did', () => {
    expect(isMuportDID('abc')).toEqual(false)
    expect(isMuportDID('did:example')).toEqual(false)
    expect(isMuportDID('did:muport')).toEqual(false)
    expect(isMuportDID('did:muport:Qmb9E8wLqjfAqfKhideoApU5g26Yz2Q2bSp6MSZmc5WrNr')).toEqual(true)
  })

  test('isClaim', async () => {
    expect(await isClaim(CLAIM_1)).toEqual(true)
    expect(await isClaim(INVALID_CLAIM_FORMAT)).toEqual(false)
    expect(await isClaim(EXPIRED_CLAIM)).toEqual(true) // invalid claim will throw during verify
  })
})
