const assert = require("chai").assert;
const IPFSFactory = require("ipfsd-ctl");
const ProfileStore = require("../profileStore");

describe("ProfileStore", () => {
  let ipfsd;
  let profileStore;

  let updateRoot = () => {};
  let linkProfile = () => {};

  beforeAll(async () => {
    ipfsd = await spawnIPFSD();
    profileStore = new ProfileStore(ipfsd.api, updateRoot, linkProfile);
  });

  it("", async () => {});

  afterAll(() => {
    ipfsd.stop();
  });
});

function spawnIPFSD() {
  return new Promise((resolve, reject) => {
    const f = IPFSFactory.create({ type: "proc", exec: require("ipfs") });
    f.spawn(function(err, ipfsd) {
      if (err) reject(err);
      resolve(ipfsd);
    });
  });
}
