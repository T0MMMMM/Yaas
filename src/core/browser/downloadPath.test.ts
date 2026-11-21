import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { uniqueDownloadPath } from './downloadPath'

const dir = join('home', 'Downloads')

describe('uniqueDownloadPath', () => {
  it('keeps the name while it is free', () => {
    expect(uniqueDownloadPath(dir, 'a.pdf', () => false)).toBe(join(dir, 'a.pdf'))
  })

  it('numbers the name before its extension: a (1).pdf, a (2).pdf', () => {
    const taken = new Set([join(dir, 'a.pdf')])
    expect(uniqueDownloadPath(dir, 'a.pdf', (p) => taken.has(p))).toBe(join(dir, 'a (1).pdf'))
    taken.add(join(dir, 'a (1).pdf'))
    expect(uniqueDownloadPath(dir, 'a.pdf', (p) => taken.has(p))).toBe(join(dir, 'a (2).pdf'))
  })

  it('numbers a name without an extension', () => {
    const taken = new Set([join(dir, 'a')])
    expect(uniqueDownloadPath(dir, 'a', (p) => taken.has(p))).toBe(join(dir, 'a (1)'))
  })

  it('numbers a dotfile or a double extension sensibly', () => {
    const taken = new Set([join(dir, '.env'), join(dir, 'a.tar.gz')])
    expect(uniqueDownloadPath(dir, '.env', (p) => taken.has(p))).toBe(join(dir, '.env (1)'))
    expect(uniqueDownloadPath(dir, 'a.tar.gz', (p) => taken.has(p))).toBe(join(dir, 'a.tar (1).gz'))
  })

  it('never lets a name leave the folder', () => {
    expect(uniqueDownloadPath(dir, '../../evil.txt', () => false)).toBe(join(dir, 'evil.txt'))
  })
})
