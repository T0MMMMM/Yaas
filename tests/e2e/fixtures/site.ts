import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

const pages: Record<string, string> = {
  '/a': `<!doctype html><html><head><title>Page A</title>
<meta name="theme-color" content="#123456"></head>
<body><a id="b" href="/b">B</a> <a id="pop" href="/b" target="_blank">Pop</a></body></html>`,
  '/b': `<!doctype html><html><head><title>Page B</title>
<meta name="theme-color" content="#f5f5f0"></head><body>B</body></html>`,
  '/c': `<!doctype html><html><head><title>Page C</title></head><body>C</body></html>`,
  '/long': `<!doctype html><html><head><title>${'A very long page title '.repeat(4).slice(0, 80)}</title></head><body>Long</body></html>`,
  '/huge': `<!doctype html><html><head><title>${'Huge title '.repeat(300)}</title></head><body>Huge</body></html>`,
  '/with-ad': `<!doctype html><html><head><title>With Ad</title></head>
<body><img id="ad" src="/ads/banner.png" alt=""></body></html>`,
  '/with-icon': `<!doctype html><html><head><title>With Icon</title>
<link rel="icon" href="/favicon.png"></head><body>Icon</body></html>`,
}

/** A transparent 1×1 PNG: the "ad" of `/with-ad` (blocked by `fixtures/ads.txt`), and the favicon. */
const BANNER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

/** A tiny local site for the browser e2e tests (no network). */
export async function startSite(): Promise<{
  url: (path: string) => string
  close: () => Promise<void>
}> {
  const server = createServer((req, res) => {
    if (req.url === '/ads/banner.png' || req.url === '/favicon.png') {
      res.writeHead(200, { 'content-type': 'image/png' }).end(BANNER_PNG)
      return
    }
    const body = pages[req.url ?? '']
    if (body === undefined) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: (path) => `http://127.0.0.1:${port}${path}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections()
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}
