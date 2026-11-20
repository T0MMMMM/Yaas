/* global location, window */
// Opens the URL given as `?open=` like 1Password's popup does with its sign-in page.
const url = new URLSearchParams(location.search).get('open')
if (url) window.open(url)
