bopen.addEventListener('click', event => {
  const syncComplete = (res) => {
    console.log('Sync Complete')
    updateProfileData(window.box)
  }
  window.ethereum.enable().then(addresses => {
    Box.openBox(addresses[0],  window.ethereum).then(box => {
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
