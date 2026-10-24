import { useEffect, useRef, useState } from 'react';
import { APP_NAME } from '../config';
import { hasDemo } from '../data/demo';
import { parseImport } from '../data/transfer';
import { LIMITS } from '../domain/limits';
import { PREMIUM_PERKS } from '../domain/premium';
import type { Snapshot } from '../domain/types';
import { THEMES } from '../themes';
import { AdminPanel } from '../ui/AdminPanel';
import { promptInstall } from '../pwa/register';
import { useStore } from '../state/store';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { usePwa } from '../ui/overlays';


type Persist = 'unknown' | 'persistent' | 'best-effort' | 'unsupported';

export function Settings() {
  const { snap, act, confirm, notify, today, premium, billing } = useStore();
  const pwa = usePwa();
  const s = snap.settings;
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(s.playerName);
  const [pending, setPending] = useState<Snapshot | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [persist, setPersist] = useState<Persist>('unknown');

  useEffect(() => setName(s.playerName), [s.playerName]);

  useEffect(() => {
    if (!navigator.storage?.persisted) return setPersist('unsupported');
    void navigator.storage.persisted().then((yes) => setPersist(yes ? 'persistent' : 'best-effort'));
  }, []);

  const requestPersist = async () => {
    const granted = await navigator.storage.persist();
    setPersist(granted ? 'persistent' : 'best-effort');
    notify(granted ? 'Storage is now protected from automatic cleanup.' : 'The browser did not grant protected storage. Installing the app usually enables it.');
  };

  const exportData = () => {
    const blob = new Blob([act.exportText()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questaday-backup-${today}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    notify('Backup downloaded. It is not encrypted — keep it somewhere private.');
  };

  const chooseFile = async (file: File | undefined) => {
    setImportErrors([]);
    if (!file) return;
    // Reject before reading: a real backup is far smaller than this.
    if (file.size > LIMITS.importChars * 2) return setImportErrors(['The file is too large to be a backup from this app.']);
    let text: string;
    try {
      text = await file.text();
    } catch {
      return setImportErrors(['The file could not be read.']);
    }
    const result = parseImport(text);
    if (result.ok) setPending(result.data);
    else setImportErrors(result.errors);
  };

  const runImport = async (mode: 'replace' | 'merge') => {
    if (!pending) return;
    const data = pending;
    setPending(null);
    if (await act.importData(data, mode)) notify(mode === 'replace' ? 'Backup restored.' : 'Backup merged into your data.');
  };

  const wipe = async () => {
    const yes = await confirm({
      title: 'Erase everything?',
      body: 'All quests, chores, rewards, XP, achievements and settings on this device will be permanently deleted. Export a backup first if you might want them back.',
      confirmLabel: 'Erase all data',
      danger: true,
    });
    if (yes) {
      await act.wipe();
      notify('All data on this device was erased.');
    }
  };

  const demoPresent = hasDemo([...snap.tasks, ...snap.chores, ...snap.rewards].map((r) => r.id));

  return (
    <>
      <section className="card stack" aria-labelledby="s-you">
        <h2 id="s-you">You</h2>
        <label className="field">
          <span>Name (optional, used in the greeting)</span>
          <input className="input" value={name} maxLength={LIMITS.playerName} autoComplete="off" onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() !== s.playerName && void act.saveSettings({ playerName: name })} />
        </label>
        <div className="field">
          <span>Theme</span>
          <div className="themes" role="group" aria-label="Theme">
            {THEMES.map((t) => (
              <button key={t.id} type="button" className="theme-pick" data-theme-id={t.id} aria-pressed={s.theme === t.id} onClick={() => void act.saveSettings({ theme: t.id })}>
                <span className="swatch" aria-hidden="true">
                  {t.swatch.map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
                <strong>{t.name}</strong>
                <span className="muted small">{t.blurb}</span>
              </button>
            ))}
            <button type="button" className="theme-pick" aria-pressed={s.theme === 'system'} onClick={() => void act.saveSettings({ theme: 'system' })}>
              <span className="swatch" aria-hidden="true">
                <i style={{ background: '#f4e9d2' }} />
                <i style={{ background: '#17162b' }} />
              </span>
              <strong>Match device</strong>
              <span className="muted small">Wildwood by day, Nightfall by night</span>
            </button>
          </div>
        </div>
      </section>

      <section className="card stack" aria-labelledby="s-premium">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h2 id="s-premium">QuestAday Premium</h2>
          <span className={premium ? 'premium-badge' : 'muted small'}>{premium ? 'Unlocked' : 'One-time unlock'}</span>
        </div>
        <p className="muted small">The free version is the whole quest journal, chores, real-life treats and a starter town. Premium is a one-time unlock that adds:</p>
        <ul className="perks small">
          {PREMIUM_PERKS.map((p) => (
            <li key={p.feature}>{p.text}</li>
          ))}
        </ul>
        {!premium && (
          <button type="button" className="btn gold" onClick={() => act.openPaywall('general')}>
            Unlock Premium
          </button>
        )}
        {premium && billing.canPurchase && <p className="muted small">Bought on Google Play. On a new phone, it comes back automatically when you sign in to the same Google account (or tap Restore purchase).</p>}
      </section>

      {__QA_ADMIN__ && <AdminPanel />}

      <section className="card stack" aria-labelledby="s-game">
        <h2 id="s-game">Game rules</h2>
        <div className="grid-2">
          <label className="field">
            <span>Coins per XP</span>
            <select className="input" value={String(s.coinRate)} onChange={(e) => void act.saveSettings({ coinRate: Number(e.target.value) })}>
              {[0.5, 1, 2, 5].concat([0.5, 1, 2, 5].includes(s.coinRate) ? [] : [s.coinRate]).map((r) => (
                <option key={r} value={String(r)}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Weekly challenge (completions)</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              max={LIMITS.maxWeeklyGoal}
              defaultValue={s.weeklyGoal}
              key={s.weeklyGoal}
              onBlur={(e) => {
                const n = Math.floor(Number(e.target.value));
                if (Number.isFinite(n) && n >= 1 && n <= LIMITS.maxWeeklyGoal && n !== s.weeklyGoal) void act.saveSettings({ weeklyGoal: n });
                else e.target.value = String(s.weeklyGoal);
              }}
            />
          </label>
        </div>
        <label className="switch">
          <span>Show streaks (ending one never costs XP or levels)</span>
          <input type="checkbox" checked={s.showStreak} onChange={(e) => void act.saveSettings({ showStreak: e.target.checked })} />
        </label>
        <p className="muted small">The coin rate applies to future completions only. XP per level: 100 for the first, then 50 more each level.</p>
      </section>

      <section className="card stack" aria-labelledby="s-data">
        <h2 id="s-data">Your data</h2>
        <div className="note">
          <strong>Stored on this device only.</strong> {APP_NAME} has no account, no server and no sync. Nothing you enter leaves this browser, and it will not appear on your other devices. To move or protect your data, export a backup.
        </div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={exportData}>
            <Icon name="download" size={18} />
            Export backup
          </button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
            <Icon name="upload" size={18} />
            Import backup
          </button>
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            aria-label="Backup file to import"
            tabIndex={-1}
            onChange={(e) => {
              void chooseFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        {importErrors.length > 0 && (
          <div className="note warn" role="alert">
            <strong>That file can’t be imported.</strong> Nothing was changed.
            <ul>
              {importErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="muted small">
          Backups are plain, unencrypted JSON. Data in the app is not encrypted either: anyone who can unlock this device and open this browser can read it. Use your device’s screen lock and disk encryption.
        </p>
        <div className="btn-row">
          {demoPresent ? (
            <button type="button" className="btn small" onClick={() => void act.removeDemo()}>
              Remove example data
            </button>
          ) : (
            <button type="button" className="btn small" onClick={() => void act.loadDemo()}>
              Load example data
            </button>
          )}
          <button type="button" className="btn small danger" onClick={() => void wipe()}>
            <Icon name="trash" size={16} />
            Erase all data
          </button>
        </div>
      </section>

      <section className="card stack" aria-labelledby="s-app">
        <h2 id="s-app">App</h2>
        <ul className="list small">
          <li>
            <strong>Installed:</strong> {pwa.standalone ? 'yes, running as an app' : 'no, running in a browser tab'}
          </li>
          <li>
            <strong>Offline:</strong> {pwa.offlineReady ? 'ready, opens without a connection' : 'not available here (needs https or localhost)'}
          </li>
          <li>
            <strong>Storage:</strong>{' '}
            {persist === 'persistent' ? 'protected from automatic cleanup' : persist === 'best-effort' ? 'best-effort (the browser may clear it if the device runs very low on space)' : persist === 'unsupported' ? 'status unavailable in this browser' : 'checking…'}
          </li>
          <li>
            <strong>Sync:</strong> none. Each device keeps its own separate data.
          </li>
        </ul>
        <div className="btn-row">
          {pwa.canInstall && (
            <button type="button" className="btn primary small" onClick={() => void promptInstall()}>
              <Icon name="download" size={16} />
              Install app
            </button>
          )}
          {persist === 'best-effort' && (
            <button type="button" className="btn small" onClick={() => void requestPersist()}>
              <Icon name="shield" size={16} />
              Protect storage
            </button>
          )}
        </div>
      </section>

      <Dialog open={pending !== null} onClose={() => setPending(null)} title="Import this backup?">
        {pending && (
          <>
            <p>
              The file is valid and contains {pending.tasks.length} quests, {pending.chores.length} chores, {pending.rewards.length} rewards and {pending.events.length} history entries.
            </p>
            <div className="note warn">Only import backups you exported yourself. A file from someone else could replace your progress with theirs.</div>
            <div className="stack" style={{ gap: 10 }}>
              <button type="button" className="btn" data-autofocus onClick={() => void runImport('merge')}>
                Merge: add what’s missing, keep what I have
              </button>
              <button type="button" className="btn danger" onClick={() => void runImport('replace')}>
                Replace everything on this device
              </button>
              <button type="button" className="btn" onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
