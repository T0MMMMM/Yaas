/* global chrome, location, window */
const params = new URLSearchParams(location.search)
// `?open=`: window.open, like 1Password's popup does with its sign-in page.
const open = params.get('open')
if (open) window.open(open)
// `?create=`: chrome.windows.create, like OAuth flows; the test then calls `removeCreated()`.
const create = params.get('create')
let created = null
if (create) {
  void chrome.windows.create({ url: create, type: 'popup' }).then((win) => {
    created = win
  })
}
window.removeCreated = async () => {
  if (!created) return 'not created yet'
  await chrome.windows.remove(created.id)
  return 'removed'
}
