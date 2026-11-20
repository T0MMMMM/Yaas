import { describe, expect, it } from 'vitest'
import { chromeUserAgent } from './userAgent'

describe('chromeUserAgent', () => {
  it('removes the Electron and ACAB tokens, nothing else', () => {
    expect(
      chromeUserAgent(
        'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) ACAB/0.0.1 Chrome/140.0.0.0 Electron/45.4.1 Safari/537.36',
      ),
    ).toBe(
      'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    )
  })
})
