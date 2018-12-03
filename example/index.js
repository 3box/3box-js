bopen.addEventListener('click', event => {

  const IPFS_OPTIONS = {
    EXPERIMENTAL: {
      pubsub: true
    },
    preload: { enabled: false }
  }

  /**
   *  This uses a local ipfs-js instance and local orbitdb cache instead of the
   *  shared iframe storage available at 3box.io. Easier for testing and differing
   *  configs. But in production you will get the best performance by using the
   *  default iframe configuration.
   */
  const ipfs = new window.Ipfs(IPFS_OPTIONS)
  const opts = { ipfs, iframeStore: false }

  const syncComplete = (res) => {
    console.log('Sync Complete')
    updateProfileData(window.box)
  }

  window.ethereum.enable().then(addresses => {
    Box.openBox(addresses[0],  window.ethereum, opts).then(box => {
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

      bclose.addEventListener('click', () => {
        logout(box)
      })
    })
  })
})

getProfile.addEventListener('click', () => {
  console.log(ethAddr.value)
  Box.getProfile(ethAddr.value, opts).then(profile => {
    console.log(profile)
    Object.entries(profile).map(kv => {
      getProfileData.innerHTML +=kv[0] + ': ' + kv[1] + '<br />'
    })
  })
})

function updateProfileData(box) {
  profileData.innerHTML = ''
  box.public.all().then(profile => {
    console.log(profile)
    Object.entries(profile).map(kv => {
      profileData.innerHTML +=kv[0] + ': ' + kv[1] + '<br />'
    })
  })
}

function updatePrivateData(key, value) {
  privateStoreData.innerHTML = ''
  privateStoreData.innerHTML  = key + ': ' + value
}

function logout(box){
  box.logout().then(() => {
    privateStoreData.innerHTML = ''
    profileData.innerHTML = ''
    controlls.style.display = 'none'
  })
}
