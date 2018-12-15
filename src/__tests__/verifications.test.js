const Verifications = require('../verifications')
const Box = require('../3box')

const GITHUB_LINK1_URL = "https://gist.githubusercontent.com/user1/12345"
const GITHUB_LINK1_CONTENT = "some random text did:muport:0x12345 more random text"
const GITHUB_LINK1_USER = "user1"
const GITHUB_LINK2_URL = "https://gist.githubusercontent.com/user1/wrongLink"
const GITHUB_LINK2_CONTENT = "wrong did"

jest.mock('../3box')
jest.mock('../utils', () => {
  const GITHUB_LINK1_URL = "https://gist.githubusercontent.com/user1/12345"
  const GITHUB_LINK1_CONTENT = "some random text did:muport:0x12345 more random text"
  const GITHUB_LINK1_USER = "user1"
  const GITHUB_LINK2_URL = "https://gist.githubusercontent.com/user1/wrongLink"
  const GITHUB_LINK2_CONTENT = "wrong did"
  return {
    fetchText: jest.fn(async url => {
        if (url === GITHUB_LINK1_URL) {
          return GITHUB_LINK1_CONTENT
        }
        else if(url === GITHUB_LINK2_URL) {
          return GITHUB_LINK2_CONTENT
        }
        else {
          throw new Error("ERROR");
        }
    })
  }
})

describe('Verifications', () => {
  let box
  let verifications

  beforeAll(async () => {
    box = await Box.openBox("0x12345", "web3prov");
    verifications = new Verifications(box)
  })


  it('should add the github proof and get the github handler to verify if it is verified', async () => {
    await verifications.addGithub(GITHUB_LINK1_URL)
    let github = await verifications.github()
    expect(github).toEqual(GITHUB_LINK1_USER)
  })

  it('should throw if gistUrl does not contain the correct did', async () => {
    expect(verifications.addGithub(GITHUB_LINK2_URL)).rejects.toEqual(new Error('Gist File provided does not contain the correct DID of the user'))
  })

  it('should throw if gistUrl is empty', async () => {
    expect(verifications.addGithub("")).rejects.toEqual(new Error('The proof of your Github is not available'))
  })
})
