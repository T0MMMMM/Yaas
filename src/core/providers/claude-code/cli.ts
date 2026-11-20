// The Claude Code CLI as seen from ACAB: where it is, which version, who is signed in.
// Process execution is injected so this module is tested without spawning anything.
import { execFile } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import { z } from 'zod'

export type Exec = (
  file: string,
  args: string[],
  env: NodeJS.ProcessEnv,
) => Promise<{ stdout: string; exitCode: number }>

export const execProcess: Exec = (file, args, env) =>
  new Promise((resolve, reject) => {
    execFile(file, args, { env, timeout: 15_000, windowsHide: true }, (error, stdout) => {
      if (error && typeof error.code !== 'number') reject(error)
      else resolve({ stdout, exitCode: typeof error?.code === 'number' ? error.code : 0 })
    })
  })

/** Where the CLI usually lives; apps launched from Finder don't inherit the shell PATH. */
export function cliCandidates(env: NodeJS.ProcessEnv, home = homedir()): string[] {
  const exe = process.platform === 'win32' ? 'claude.exe' : 'claude'
  const fromPath = (env['PATH'] ?? '').split(delimiter).filter(Boolean)
  const usual = [
    join(home, '.local', 'bin'),
    join(home, '.claude', 'local'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ]
  return [...new Set([...fromPath, ...usual])].map((dir) => join(dir, exe))
}

export function findCli(
  env: NodeJS.ProcessEnv = process.env,
  isExecutable: (file: string) => boolean = canExecute,
): string | null {
  return cliCandidates(env).find(isExecutable) ?? null
}

function canExecute(file: string): boolean {
  try {
    accessSync(file, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** Environment for a CLI call on one account: CLAUDE_CONFIG_DIR only for non-default accounts. */
export function accountEnv(configDir: string | null, base: NodeJS.ProcessEnv = process.env) {
  const env = { ...base }
  if (configDir) env['CLAUDE_CONFIG_DIR'] = configDir
  else delete env['CLAUDE_CONFIG_DIR']
  return env
}

export async function cliVersion(cli: string, exec: Exec = execProcess): Promise<string | null> {
  const { stdout, exitCode } = await exec(cli, ['--version'], process.env)
  if (exitCode !== 0) return null
  return /^(\d+\.\d+\.\d+)/.exec(stdout.trim())?.[1] ?? null
}

const authStatusSchema = z.object({
  loggedIn: z.boolean(),
  authMethod: z.string(),
  email: z.string().optional(),
  orgName: z.string().optional(),
  subscriptionType: z.string().optional(),
})

export interface AuthStatus {
  loggedIn: boolean
  authMethod: 'claude.ai' | 'console' | 'oauth-token' | 'none'
  email: string | null
  orgName: string | null
  plan: string | null
}

/** `claude auth status` (JSON) for one config dir — null = the default ~/.claude. */
export async function authStatus(
  cli: string,
  configDir: string | null,
  exec: Exec = execProcess,
): Promise<AuthStatus> {
  const { stdout } = await exec(cli, ['auth', 'status'], accountEnv(configDir))
  const raw = authStatusSchema.parse(JSON.parse(stdout))
  const method = raw.authMethod
  return {
    loggedIn: raw.loggedIn,
    authMethod:
      method === 'claude.ai' || method === 'console' || method === 'oauth-token' ? method : 'none',
    email: raw.email ?? null,
    orgName: raw.orgName ?? null,
    plan: raw.subscriptionType ?? null,
  }
}
