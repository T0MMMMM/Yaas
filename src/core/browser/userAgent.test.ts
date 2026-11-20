import { describe, expect, it } from 'vitest'
import { chromeUserAgent } from './userAgent'

const CHROME =
  'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

describe('chromeUserAgent', () => {
  it('removes the Electron and Big Browser tokens, nothing else', () => {
    expect(
      chromeUserAgent(
        'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Big Browser/0.0.1 Chrome/140.0.0.0 Electron/45.4.1 Safari/537.36',
      ),
    ).toBe(CHROME)
  })

  it('also removes the app token when Electron drops the space from the name', () => {
    expect(
      chromeUserAgent(
        'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) BigBrowser/0.0.1 Chrome/140.0.0.0 Electron/45.4.1 Safari/537.36',
      ),
    ).toBe(CHROME)
  })
})
