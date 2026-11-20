import { describe, expect, it } from 'vitest'
import { FAVICON_MAX_BYTES, faviconDataUrl } from './favicon'

describe('faviconDataUrl', () => {
  it('encodes an image of up to 64 KB as a data URL', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    expect(faviconDataUrl('image/png', bytes)).toBe('data:image/png;base64,iVBORw==')
    expect(faviconDataUrl('image/png', new Uint8Array(FAVICON_MAX_BYTES))).toMatch(
      /^data:image\/png;base64,/,
    )
  })

  it('keeps only the media type of the content type', () => {
    expect(faviconDataUrl('Image/X-Icon; charset=binary', new Uint8Array([1]))).toBe(
      'data:image/x-icon;base64,AQ==',
    )
  })

  it('ignores a response that is not an image', () => {
    expect(faviconDataUrl('text/html', new Uint8Array([1]))).toBeNull()
    expect(faviconDataUrl('', new Uint8Array([1]))).toBeNull()
  })

  it('ignores an image over 64 KB or an empty one', () => {
    expect(faviconDataUrl('image/png', new Uint8Array(65 * 1024))).toBeNull()
    expect(faviconDataUrl('image/png', new Uint8Array(0))).toBeNull()
  })
})
