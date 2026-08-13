/**
 * Check GitHub Releases for a newer CTrack Publisher build and install it.
 * Artists install once from the web; later builds update in-app.
 */
import { autoUpdater } from 'electron-updater'
import { BrowserWindow, Notification, app } from 'electron'

let started = false

function sendStatus(
  getMainWindow: () => BrowserWindow | null,
  payload: Record<string, unknown>
): void {
  const win = getMainWindow()
  win?.webContents.send('updater:status', payload)
}

export function startAutoUpdater(getMainWindow: () => BrowserWindow | null): void {
  if (started) return
  if (!app.isPackaged) {
    console.log('[auto-update] Skipped in development')
    return
  }
  started = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    console.log('[auto-update] Checking for update…')
    sendStatus(getMainWindow, { status: 'checking', version: app.getVersion() })
  })
  autoUpdater.on('update-available', (info) => {
    console.log('[auto-update] Update available:', info.version)
    sendStatus(getMainWindow, { status: 'available', version: info.version })
    if (Notification.isSupported()) {
      new Notification({
        title: 'CTrack Publisher update',
        body: `Version ${info.version} is available. Please update.`,
      }).show()
    }
  })
  autoUpdater.on('update-not-available', () => {
    console.log('[auto-update] Already on latest')
    sendStatus(getMainWindow, { status: 'current', version: app.getVersion() })
  })
  autoUpdater.on('download-progress', (p) => {
    sendStatus(getMainWindow, {
      status: 'downloading',
      percent: p.percent,
      version: undefined,
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[auto-update] Downloaded', info.version, '— waiting for user to restart')
    sendStatus(getMainWindow, { status: 'ready', version: info.version })
    if (Notification.isSupported()) {
      new Notification({
        title: 'CTrack Publisher update ready',
        body: `Version ${info.version} downloaded. Please restart to update.`,
      }).show()
    }
  })
  autoUpdater.on('error', (err) => {
    console.warn('[auto-update] Error:', err?.message || err)
    sendStatus(getMainWindow, { status: 'error', message: String(err?.message || err) })
  })

  const check = () => {
    void autoUpdater.checkForUpdates().catch((e) => {
      console.warn('[auto-update] check failed:', e)
    })
  }

  setTimeout(check, 1200)
  setInterval(check, 4 * 60 * 60 * 1000)
}

export function checkForUpdatesOnLaunch(): void {
  if (!app.isPackaged) return
  void autoUpdater.checkForUpdates().catch((e) => {
    console.warn('[auto-update] launch check failed:', e)
  })
}

export async function checkForUpdatesNow(): Promise<{ ok: boolean; message?: string }> {
  if (!app.isPackaged) return { ok: false, message: 'Updates only apply to installed builds' }
  try {
    const result = await autoUpdater.checkForUpdates()
    return { ok: true, message: result?.updateInfo?.version }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

export function installUpdateNow(): { ok: boolean; message?: string } {
  if (!app.isPackaged) return { ok: false, message: 'Updates only apply to installed builds' }
  try {
    autoUpdater.quitAndInstall(false, true)
    return { ok: true }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}
