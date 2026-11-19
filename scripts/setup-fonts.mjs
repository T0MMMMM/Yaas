// Copies the Satoshi variable font into the renderer's public folder.
// Satoshi's license (ITF FFL) allows embedding it in the app but forbids redistributing it through
// a repository, so the files are git-ignored: each developer downloads Satoshi from fontshare.com
// and runs:  npm run setup:fonts -- <path to the unzipped Satoshi_Complete folder>
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const source = process.argv[2]
if (!source) {
  console.error('Usage: npm run setup:fonts -- <path to Satoshi_Complete>')
  process.exit(1)
}
const fontsDir = join(resolve(source), 'Fonts', 'WEB', 'fonts')
const target = join(import.meta.dirname, '..', 'src', 'renderer', 'public', 'fonts')
mkdirSync(target, { recursive: true })
for (const file of ['Satoshi-Variable.woff2', 'Satoshi-VariableItalic.woff2']) {
  const from = join(fontsDir, file)
  if (!existsSync(from)) {
    console.error(`Missing ${from}`)
    process.exit(1)
  }
  copyFileSync(from, join(target, file))
  console.warn(`copied ${file}`)
}
