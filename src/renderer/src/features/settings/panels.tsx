import { SHORTCUTS } from '../../app/shortcuts'
import { useSettings } from '../../stores/settings'
import { useUi } from '../../stores/ui'
import { Segmented } from '../../ui/Segmented'
import { Switch } from '../../ui/Switch'
import { useSessionWorkspace } from '../workspace/useWorkspace'
import { AppearanceFields } from './AppearanceFields'
import fields from './Fields.module.css'
import { SettingGroup, SettingRow } from './SettingRow'
import styles from './SettingsView.module.css'

const ARCHIVE_DAYS = [1, 3, 7, 14, 30]

export function General() {
  return (
    <SettingGroup>
      <SettingRow label="Open at login" description="Start ACAB when you log in." soon>
        <Switch label="Open at login" checked={false} disabled />
      </SettingRow>
      <SettingRow
        label="Restore open sessions on launch"
        description="Reopen the sessions that were open when you quit."
        soon
      >
        <Switch label="Restore sessions" checked disabled />
      </SettingRow>
      <SettingRow label="Default folder for new sessions" soon>
        <select className={fields.select} disabled>
          <option>Last used</option>
          <option>Ask every time</option>
          <option>Fixed folder…</option>
        </select>
      </SettingRow>
      <SettingRow
        label="Confirm before closing a running session"
        description="Closing stops the Claude process; the session itself is kept."
        soon
      >
        <Switch label="Confirm before closing" checked disabled />
      </SettingRow>
      <SettingRow label="Language" soon>
        <select className={fields.select} disabled>
          <option>English</option>
        </select>
      </SettingRow>
      <SettingRow label="Check for updates" soon>
        <select className={fields.select} disabled>
          <option>Automatically</option>
          <option>Manually</option>
        </select>
      </SettingRow>
    </SettingGroup>
  )
}

export function Appearance() {
  const { settings, update } = useSettings()
  if (!settings) return null
  return (
    <>
      <SettingGroup title="Theme">
        <div className={fields.fields}>
          <AppearanceFields />
        </div>
      </SettingGroup>
      <SettingGroup title="Layout and motion">
        <SettingRow
          label="Askew cards"
          description="Hovered and selected cards tilt slightly, each at its own angle."
        >
          <Switch
            label="Askew cards"
            checked={settings.askewCards}
            onChange={(askewCards) => void update({ askewCards })}
          />
        </SettingRow>
        <SettingRow
          label="Automatic folders"
          description="Three or more of today's tabs from one site are grouped in a folder named after it."
        >
          <Switch
            label="Automatic folders"
            checked={settings.autoFolders}
            onChange={(autoFolders) => void update({ autoFolders })}
          />
        </SettingRow>
        <SettingRow
          label="Address bar"
          description="In its own card above the page, or attached to the page with a separator."
        >
          <Segmented
            label="Address bar"
            value={settings.contextBarStyle}
            options={[
              { value: 'card', label: 'Own card' },
              { value: 'attached', label: 'Attached' },
            ]}
            onChange={(contextBarStyle) => void update({ contextBarStyle })}
          />
        </SettingRow>
      </SettingGroup>
      <SettingGroup title="Text">
        <SettingRow label="Interface density" soon>
          <Segmented
            label="Density"
            value="comfortable"
            disabled
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
            onChange={() => undefined}
          />
        </SettingRow>
        <SettingRow label="Transcript font size" soon>
          <select className={fields.select} disabled defaultValue="13">
            {[12, 13, 14, 15].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </SettingRow>
      </SettingGroup>
    </>
  )
}

export function Accounts() {
  const { spaces, demo } = useSessionWorkspace()
  return (
    <>
      <SettingGroup>
        {spaces.map((space) => (
          <SettingRow
            key={space.id}
            label={`${space.emoji}  ${space.label}`}
            description={demo ? 'Demo account' : undefined}
          >
            <button className={styles.button} disabled>
              Edit
            </button>
          </SettingRow>
        ))}
        <div className={styles.actions}>
          <button className={styles.button} disabled>
            Add account
          </button>
          <span className={styles.soon}>Soon</span>
        </div>
      </SettingGroup>
      <SettingGroup title="Per account">
        <SettingRow label="Default model" soon>
          <select className={fields.select} disabled>
            <option>Account default</option>
          </select>
        </SettingRow>
        <SettingRow label="Default context profile" soon>
          <select className={fields.select} disabled>
            <option>Clean</option>
          </select>
        </SettingRow>
        <SettingRow
          label="Custom usage reset schedule"
          description="Your own reset time per weekday, if it differs from what Claude reports."
          soon
        />
      </SettingGroup>
    </>
  )
}

export function Sessions() {
  const { settings, update } = useSettings()
  if (!settings) return null
  const archive = settings.autoArchive
  return (
    <SettingGroup>
      <SettingRow label="Default model for new sessions" soon>
        <select className={fields.select} disabled>
          <option>Account default</option>
          <option>Opus</option>
          <option>Sonnet</option>
          <option>Haiku</option>
        </select>
      </SettingRow>
      <SettingRow label="Default permission mode" soon>
        <select className={fields.select} disabled>
          <option>Ask</option>
          <option>Accept edits</option>
          <option>Plan</option>
        </select>
      </SettingRow>
      <SettingRow
        label="Close idle Claude processes after"
        description="Frees memory; the session resumes transparently on your next message."
        soon
      >
        <select className={fields.select} disabled defaultValue="10">
          <option value="5">5 min</option>
          <option value="10">10 min</option>
          <option value="30">30 min</option>
          <option value="never">Never</option>
        </select>
      </SettingRow>
      <SettingRow
        label="Auto-archive inactive sessions"
        description="Archives (never deletes). Pinned sessions are never archived."
      >
        <select
          className={fields.select}
          aria-label="Archive after"
          disabled={!archive.enabled}
          value={archive.afterDays}
          onChange={(e) =>
            void update({ autoArchive: { ...archive, afterDays: Number(e.target.value) } })
          }
        >
          {ARCHIVE_DAYS.map((d) => (
            <option key={d} value={d}>
              after {d} {d === 1 ? 'day' : 'days'}
            </option>
          ))}
        </select>
        <Switch
          label="Auto-archive"
          checked={archive.enabled}
          onChange={(enabled) => void update({ autoArchive: { ...archive, enabled } })}
        />
      </SettingRow>
    </SettingGroup>
  )
}

export function Profiles() {
  return (
    <SettingGroup>
      <SettingRow
        label="Clean"
        description="Only what you pick per session — fewest tokens."
        soon
      />
      <SettingRow
        label="Inherit ~/.claude"
        description="All your global skills, plugins and MCP servers."
        soon
      />
      <SettingRow label="Default profile for new sessions" soon>
        <select className={fields.select} disabled>
          <option>Clean</option>
        </select>
      </SettingRow>
    </SettingGroup>
  )
}

export function Permissions() {
  return (
    <SettingGroup>
      <p className={styles.empty}>
        No saved rules yet. Rules appear here when you choose “Always”.
      </p>
      <SettingRow label="Confirm account-wide rules twice" soon>
        <Switch label="Confirm account-wide rules" checked disabled />
      </SettingRow>
    </SettingGroup>
  )
}

export function Handoff() {
  return (
    <SettingGroup>
      <SettingRow
        label="Suggest a handoff when usage reaches"
        description="ACAB proposes; it never switches accounts on its own."
        soon
      >
        <select className={fields.select} disabled defaultValue="90">
          <option value="80">80 %</option>
          <option value="90">90 %</option>
          <option value="limited">Only when limited</option>
        </select>
      </SettingRow>
      <SettingRow label="Fallback account order" soon />
      <SettingRow label="Default handoff mode" soon>
        <select className={fields.select} disabled>
          <option>Full transcript</option>
          <option>Hybrid</option>
        </select>
      </SettingRow>
    </SettingGroup>
  )
}

export function Crew() {
  return (
    <SettingGroup>
      <SettingRow
        label="Allow Claude to propose delegation"
        description="Adds the delegate tool to sessions; every delegation still needs your approval."
        soon
      >
        <Switch label="Allow delegation" checked={false} disabled />
      </SettingRow>
      <SettingRow label="Max parallel delegates" soon>
        <select className={fields.select} disabled defaultValue="2">
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </SettingRow>
      <SettingRow label="Run delegates in git worktrees" soon>
        <Switch label="Use worktrees" checked disabled />
      </SettingRow>
    </SettingGroup>
  )
}

export function Notifications() {
  return (
    <SettingGroup>
      <SettingRow label="Session waiting for your action" soon>
        <Switch label="Waiting" checked disabled />
      </SettingRow>
      <SettingRow label="Session finished" description="Only when ACAB is not focused." soon>
        <Switch label="Finished" checked disabled />
      </SettingRow>
      <SettingRow label="Account limited / usage reset" soon>
        <Switch label="Usage" checked disabled />
      </SettingRow>
      <SettingRow label="Sound" soon>
        <Switch label="Sound" checked={false} disabled />
      </SettingRow>
    </SettingGroup>
  )
}

export function Shortcuts() {
  return (
    <SettingGroup>
      {SHORTCUTS.map((s) => (
        <SettingRow key={s.action} label={s.action}>
          <kbd className={styles.kbd}>{s.keys}</kbd>
        </SettingRow>
      ))}
    </SettingGroup>
  )
}

export function Privacy() {
  return (
    <SettingGroup>
      <p className={styles.statement}>
        ACAB sends no telemetry and never calls a model on its own. Your data stays on this
        computer; Claude Code talks to Anthropic exactly as it does without ACAB.
      </p>
      <SettingRow label="Data folder" soon>
        <button className={styles.button} disabled>
          Reveal
        </button>
      </SettingRow>
      <SettingRow label="Export settings" soon>
        <button className={styles.button} disabled>
          Export…
        </button>
      </SettingRow>
      <SettingRow label="Rebuild search index" soon>
        <button className={styles.button} disabled>
          Rebuild
        </button>
      </SettingRow>
    </SettingGroup>
  )
}

export function Advanced() {
  const update = useSettings((s) => s.update)
  const closeSettings = useUi((s) => s.closeSettings)
  return (
    <SettingGroup>
      <SettingRow
        label="Replay onboarding"
        description="Shows the welcome flow again. Your settings and accounts are kept."
      >
        <button
          className={styles.button}
          onClick={() => {
            closeSettings()
            void update({ onboardingDone: false })
          }}
        >
          Replay
        </button>
      </SettingRow>
      <SettingRow
        label="Claude Code CLI"
        description="Bundled with ACAB, or the one on your PATH."
        soon
      >
        <Segmented
          label="CLI"
          value="bundled"
          disabled
          options={[
            { value: 'bundled', label: 'Bundled' },
            { value: 'system', label: 'System' },
          ]}
          onChange={() => undefined}
        />
      </SettingRow>
      <SettingRow label="Logs" soon>
        <button className={styles.button} disabled>
          Open folder
        </button>
      </SettingRow>
      <SettingRow label="Developer tools" soon>
        <button className={styles.button} disabled>
          Open
        </button>
      </SettingRow>
    </SettingGroup>
  )
}

export function About() {
  const info = useSettings((s) => s.info)
  return (
    <SettingGroup>
      <SettingRow label="ACAB" description="AI Custom Another Browser">
        <span className={styles.muted}>v{info?.version ?? '—'}</span>
      </SettingRow>
      <p className={styles.statement}>
        Independent project, not affiliated with Anthropic. License to be decided.
      </p>
    </SettingGroup>
  )
}
