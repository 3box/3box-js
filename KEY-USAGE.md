# Key usage

The `key` parameter is used to get, set, and remove values in both the profile and the private store. It has to be a unique string, so in order to facilitate collaboration and avoid any collisions between dapps we have created some simple rules.

## Dapp specific entries
Dapps can avoid collisions in their entries by using the following format:
```
<dapp-name>.<key-name>
```

An example for this would be,
```
ujo.description
```

## Common entries
There are lots of cases where it can be valuable for dapps to use the same entries/data, e.g. name and image in the profile, and email in the private store. Below are tables containing well known keys. Feel free to add more by making a PR :)

### ProfileStore

| key | Description |
| -- | -- |
| name | a name chosen by the user |
| image | an ipfs hash of a profile image |

### PrivateStore

| key | Description |
| -- | -- |
| email | the users email address |
