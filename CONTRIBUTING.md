# Contributing

To view the contribution guide, go to the main 3box repo here:

<https://github.com/uport-project/3box/blob/master/CONTRIBUTING.md>


## Release checklist
- [ ] Add release notes and update version in package.json
- [ ] Run `$ npm run generate-readme`
- [ ] Make sure correct dependencies are installed and that tests and builds pass
- [ ] Create release branch `release/vX.X.X`
- [ ] Make a commit `$ git commit -m "Release vX.X.X"` and make a PR to `master`
- [ ] Get at least one review and merge
- [ ] Checkout `master` locally
- [ ] When tests pass on CI tag the version `$ git tag vX.X.X` and push
- [ ] Publish to npmjs.com `$ npm publish`
- [ ] Add release notes to the tag on github
- [ ] Checkout `develop` and merge `master` into it, `$ git merge master`
- [ ] Push updated `develop` to origin, `$ git push`
