const testUtils = require('./testUtils')
const Pubsub = require('orbit-db-pubsub')
const jsdom = require('jsdom')
global.window = new jsdom.JSDOM().window

const Verifications = require('../verifications')
const Box = require('../3box')

const GITHUB_LINK1_URL = "https://gist.githubusercontent.com/user1/12345"
const GITHUB_LINK1_CONTENT = "did:muport:0x12345"
const GITHUB_LINK1_USER = "user1"
const GITHUB_LINK2_URL = "https://gist.githubusercontent.com/user1/wrongLink"
const GITHUB_LINK2_CONTENT = "wrong did"

jest.mock('../3box')

describe('Verifications', () => {
  let box
  let verifications

  beforeAll(async () => {
    box = await Box.openBox("0x12345", "web3prov");
    verifications = new Verifications(box)

    global.fetch = jest.fn().mockImplementation((url) => {
      var p = new Promise((resolve, reject) => {
        if(url === GITHUB_LINK1_URL) {
          resolve({text: () => GITHUB_LINK1_CONTENT})
        }
        else if(url === GITHUB_LINK2_URL) {
          resolve({text: () => GITHUB_LINK2_CONTENT})
        }
        else {
          resolve("ERROR");
        }
      })
      return p;
  });
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
