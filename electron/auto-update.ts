/**
 * Check GitHub Releases for a newer CTrack Publisher build and install it.
 * Artists install once from the web; later builds update in-app.
 */
import { autoUpdater } from 'electron-updater'
import { BrowserWindow, app } from 'electron'

let started = false

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
  })
  autoUpdater.on('update-available', (info) => {
    console.log('[auto-update] Update available:', info.version)
    const win = getMainWindow()
    win?.webContents.send('updater:status', { status: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', () => {
    console.log('[auto-update] Already on latest')
    const win = getMainWindow()
    win?.webContents.send('updater:status', { status: 'current', version: app.getVersion() })
  })
  autoUpdater.on('download-progress', (p) => {
    const win = getMainWindow()
    win?.webContents.send('updater:status', {
      status: 'downloading',
      percent: p.percent,
      version: undefined,
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[auto-update] Downloaded', info.version, '— installing on quit / now')
    const win = getMainWindow()
    win?.webContents.send('updater:status', { status: 'ready', version: info.version })
    // Install promptly so artists pick up features without a separate download visit
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true)
    }, 2500)
  })
  autoUpdater.on('error', (err) => {
    console.warn('[auto-update] Error:', err?.message || err)
    const win = getMainWindow()
    win?.webContents.send('updater:status', { status: 'error', message: String(err?.message || err) })
  })

  const check = () => {
    void autoUpdater.checkForUpdates().catch((e) => {
      console.warn('[auto-update] check failed:', e)
    })
  }

  // Delay so window + network settle
  setTimeout(check, 4000)
  setInterval(check, 4 * 60 * 60 * 1000)
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
