import { describe, expect, it } from 'vitest'
import { DEFAULT_SEARCH, displayUrl, resolveInput } from './url'

describe('resolveInput', () => {
  it.each([
    ['https://example.com/a', 'https://example.com/a'],
    ['  github.com/x  ', 'https://github.com/x'],
    ['example.com', 'https://example.com/'],
    ['localhost:5173', 'http://localhost:5173/'],
    ['127.0.0.1:8080/x', 'http://127.0.0.1:8080/x'],
    ['about:blank', 'about:blank'],
    ['what is acab', 'https://www.google.com/search?q=what%20is%20acab'],
    ['acab', 'https://www.google.com/search?q=acab'],
    ['javascript:alert(1)', 'https://www.google.com/search?q=javascript%3Aalert(1)'],
    ['file:///etc/passwd', 'https://www.google.com/search?q=file%3A%2F%2F%2Fetc%2Fpasswd'],
    ['data:text/html,hi', 'https://www.google.com/search?q=data%3Atext%2Fhtml%2Chi'],
  ])('%s → %s', (input, expected) => expect(resolveInput(input)).toBe(expected))

  it('uses a custom search template', () =>
    expect(resolveInput('a b', 'https://duckduckgo.com/?q=%s')).toBe(
      'https://duckduckgo.com/?q=a%20b',
    ))

  it('exposes the default search template', () =>
    expect(DEFAULT_SEARCH).toBe('https://www.google.com/search?q=%s'))
})

describe('displayUrl', () => {
  it.each([
    [
      'https://demo.agencebigmama.com/d/preview/',
      { host: 'demo.agencebigmama.com', rest: '/d/preview/' },
    ],
    ['https://www.github.com/', { host: 'github.com', rest: '' }],
    ['http://127.0.0.1:4000/a?q=1#x', { host: '127.0.0.1:4000', rest: '/a?q=1#x' }],
    ['about:blank', { host: '', rest: '' }],
    ['not a url', { host: '', rest: '' }],
  ])('%s', (url, expected) => expect(displayUrl(url)).toEqual(expected))
})
