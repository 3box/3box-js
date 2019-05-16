const syncComplete = (res) => {
  console.log('Sync Complete')
  updateProfileData(window.box)
}
bopen.addEventListener('click', event => {

  window.ethereum.enable().then(addresses => {
    window.Box.openBox(addresses[0],  window.ethereum, {}).then(box => {
      box.onSyncDone(syncComplete)
      window.box = box
      console.log(box)

      controlls.style.display = 'block'
      updateProfileData(box)

      setProfile.addEventListener('click', () => {
        box.public.set(prkey.value, prvalue.value).then(() => {
          prkey.value = null
          prvalue.value = null
          updateProfileData(box)
        })
      })
      verifyGithub.addEventListener('click', () => {
        box.verified.addGithub(gisturl.value).then(() => {
          updateProfileData(box)
        }).catch(error => {
          githubUser.innerHTML = error
        })
      })

      setPrivateStore.addEventListener('click', () => {
        box.private.set(pskey.value, psvalue.value).then(() => {
          pskey.value = null
          psvalue.value = null
        })
      })

      getPrivateStore.addEventListener('click', () => {
        const key = getpskey.value
        box.private.get(key).then(val => {
          getpskey.value = null
          updatePrivateData(key, val)
        })
      })

      openSpace.addEventListener('click', () => {
        const name = spaceName.value
        const opts = {
          onSyncDone: () => {
            console.log('sync done in space', name)
            updateSpaceData()
          }
        }
        box.openSpace(name, opts).then(() => {
          window.currentSpace = name
          spacePub.innerHTML = `Public data in ${name}:`
          spacePriv.innerHTML = `Private data in ${name}:`
          spaceCtrl.style.display = 'block'
          updateSpaceData()
        })
      })

      setSpacePub.addEventListener('click', () => {
        console.log(spkey.value, spvalue.value)
        box.spaces[window.currentSpace].public.set(spkey.value, spvalue.value).then(() => {
          spkey.value = null
          spvalue.value = null
          updateSpaceData()
        })
      })
      setSpacePriv.addEventListener('click', () => {
        console.log(sskey.value, ssvalue.value)
        box.spaces[window.currentSpace].private.set(sskey.value, ssvalue.value).then(() => {
          sskey.value = null
          ssvalue.value = null
          updateSpaceData()
        })
      })
      const updateSpaceData = () => {
        box.spaces[window.currentSpace].public.all().then(entries => {
          spaceDataPub.innerHTML = ''
          Object.keys(entries).map(k => {
            spaceDataPub.innerHTML += k + ': ' + entries[k] + '<br />'
          })
        })
        box.spaces[window.currentSpace].private.all().then(entries => {
          spaceDataPriv.innerHTML = ''
          Object.keys(entries).map(k => {
            spaceDataPriv.innerHTML += k + ': ' + entries[k] + '<br />'
          })
        })
      }

      joinThread.addEventListener('click', () => {
        const name = threadName.value
        posts.style.display = 'block'
        box.spaces[window.currentSpace].joinThread(name).then(thread => {
          window.currentThread = thread
          thread.onNewPost(post => {
            updateThreadData()
          })
          updateThreadData()
        })
      })

      addThreadMod.addEventListener('click', () => {
        const name = threadMod.value
        posts.style.display = 'block'
        window.currentThread.addMod(name).then(res => {
          console.log(res)
        })
      })

      window.deletePost = (el) => {
        window.currentThread.deletePost(el.id).then(res => {
          updateThreadData()
        })
      }

      const updateThreadData = () => {
        threadData.innerHTML = ''
        window.currentThread.getPosts().then(posts => {
          posts.map(post => {
            threadData.innerHTML += post.author + ': <br />' + post.message  + '<br /><br />'
            threadData.innerHTML += `<button id="` + post.postId + `"onClick="window.deletePost(` + post.postId + `)" type="button" class="btn btn btn-primary" >Delete</button>` + '<br /><br />'
          })
        })
      }

      postThread.addEventListener('click', () => {
        window.currentThread.post(postMsg.value)
      })

      bclose.addEventListener('click', () => {
        logout(box)
      })
    })
  })
})

getProfile.addEventListener('click', () => {
  console.log(ethAddr.value)
  window.Box.getProfile(ethAddr.value, {}).then(profile => {
    console.log(profile)
    Object.entries(profile).map(kv => {
      getProfileData.innerHTML += kv[0] + ': ' + kv[1] + '<br />'
    })
  })
})

profileGraphQL.addEventListener('click', () => {
  const query = profileGraphQLQuery.value
  console.log(query)
  window.Box.profileGraphQL(query).then(res => {
    console.log(res)
    profileGraphQLData.innerHTML = ''
    if (res.profile) {
      Object.entries(res.profile).map(kv => {
        profileGraphQLData.innerHTML +=kv[0] + ': ' + kv[1] + '<br />'
      })
    } else if (res.profiles) {
      res.profiles.map(profile => {
        Object.entries(profile).map(kv => {
          profileGraphQLData.innerHTML +=kv[0] + ': ' + kv[1] + '<br />'
        })
        profileGraphQLData.innerHTML += '<hr />'
      })
    }
  })
})

function updateProfileData(box) {
  profileData.innerHTML = ''
  box.public.all().then(profile => {
    console.log(profile)
    Object.entries(profile).map(kv => {
      profileData.innerHTML += kv[0] + ': ' + kv[1] + '<br />'
    })
  })
  updateGithubUser(box)
}

function updatePrivateData (key, value) {
  privateStoreData.innerHTML = ''
  privateStoreData.innerHTML = key + ': ' + value
}

function logout (box) {
  box.logout().then(() => {
    privateStoreData.innerHTML = ''
    profileData.innerHTML = ''
    controlls.style.display = 'none'
  })
}

function updateGithubUser (box) {
  githubUser.innerHTML = ''
  box.verified.github().then(res => {
    console.log(res.username)
    githubUser.innerHTML = res.username
  }).catch(error => {
    githubUser.innerHTML = error
  })
}
