import './bootstrap'
import { app, BrowserWindow, ipcMain, dialog, Notification, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'
import { PythonManager } from './python-manager'
import { S3Manager } from './s3-manager'
import { QueueManager } from './queue-manager'
import type { DBJobEventInput } from './queue-manager'
import { getVideoMetadata } from './video-metadata'
import { startAutoUpdater, checkForUpdatesNow, checkForUpdatesOnLaunch, installUpdateNow } from './auto-update'

const _dirname = __dirname

// The built directory structure
process.env.APP_ROOT = path.join(_dirname, '..')

function focusMainWindow(): void {
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function handleProtocolUrl(raw: string): void {
  const url = String(raw)
  focusMainWindow()
  // Auth callbacks still forward to renderer; bare "open" only focuses
  if (/ctrack-publisher:\/\/auth/i.test(url) || url.includes('code=')) {
    setTimeout(() => {
      if (win && !win.isDestroyed()) win.webContents.send('auth-callback-url', url)
    }, 200)
  }
}

// Single instance: browser / ctrack_v0 open via ctrack-publisher://
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine) => {
    const url = commandLine.find((arg) => typeof arg === 'string' && arg.startsWith('ctrack-publisher://'))
      ?? commandLine.find((arg) => typeof arg === 'string' && arg.includes('ctrack-publisher://'))
    if (url) {
      handleProtocolUrl(String(url))
    } else {
      focusMainWindow()
    }
  })
}

let pendingProtocolUrl: string | null = null
try {
  const argvUrl = process.argv.find((arg) => typeof arg === 'string' && arg.startsWith('ctrack-publisher://'))
  if (argvUrl) pendingProtocolUrl = argvUrl
} catch (_) { }

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

const AUTH_CALLBACK_PORT = 3847

let win: BrowserWindow | null
let authCallbackServer: http.Server | null = null
/** Pending OAuth code from browser callback - renderer polls via auth:get-pending-code */
let pendingAuthCode: string | null = null
const pythonManager = new PythonManager()
const s3Manager = new S3Manager()
const queueManager = new QueueManager()

function startAuthCallbackServer() {
  if (authCallbackServer) return
  authCallbackServer = http.createServer((req, res) => {
    const url = req.url ?? ''
    console.log('[auth-callback-server] Request received:', url)

    if (!url.startsWith('/auth/callback')) {
      console.log('[auth-callback-server] Invalid path, ignoring')
      res.writeHead(404)
      res.end()
      return
    }

    const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
    const code = new URLSearchParams(q).get('code')
    const error = new URLSearchParams(q).get('error')

    console.log('[auth-callback-server] Parsed - code:', code ? 'YES' : 'NO', 'error:', error ? 'YES' : 'NO')

    if (code) {
      pendingAuthCode = code
      console.log('[auth-callback-server] Stored code for renderer (poll auth:get-pending-code)')
      if (win && !win.isDestroyed()) {
        win.focus()
        win.webContents.send('auth-callback-code', code)
      }
    }
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>CTrack Login</title></head>
<body style="font-family:sans-serif;background:#1a1a1a;color:#e0e0e0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="text-align:center;padding:2rem;">
    <h1 style="color:#24E1B1;">CTrack Publisher</h1>
    ${error
        ? `<p style="color:#f87171;">Login failed. You can close this tab.</p>
           <script>setTimeout(function(){ window.close(); }, 2500);</script>`
        : `<p style="margin:1rem 0;">Login successful.</p>
           <p style="color:#94a3b8;font-size:14px;">Returning to CTrack Publisher…</p>
           <script>
             setTimeout(function(){ window.close(); }, 400);
             setTimeout(function(){ window.location.replace('about:blank'); }, 800);
           </script>`}
  </div>
</body>
</html>`
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(html)
  })
  authCallbackServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log('[auth-callback-server] Port 3847 already in use — Publisher already running. Focusing existing window.')
      return
    }
    console.warn('[auth-callback-server]', err.message)
  })
  authCallbackServer.listen(AUTH_CALLBACK_PORT, '127.0.0.1', () => {
    console.log('[auth-callback-server] Server listening on 127.0.0.1:' + AUTH_CALLBACK_PORT)
  })
}

function createWindow() {
  const iconCandidates = [
    path.join(process.env.VITE_PUBLIC || '', 'ctrack-icon.ico'),
    path.join(process.env.VITE_PUBLIC || '', 'ctrack-icon.png'),
    path.join(app.getAppPath(), 'build', 'icon.ico'),
  ]
  const iconPath = iconCandidates.find((p) => p && fs.existsSync(p))
  win = new BrowserWindow({
    title: 'CTrack Publisher',
    width: 1375,
    height: 1000,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Prevent Electron window from navigating to external URLs - force them to open in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)
    const currentUrl = win?.webContents.getURL()
    const parsedCurrent = currentUrl ? new URL(currentUrl) : null

    // Allow navigation within the app (same origin or localhost dev server)
    if (parsedCurrent && (
      parsedUrl.origin === parsedCurrent.origin ||
      parsedUrl.hostname === 'localhost' ||
      parsedUrl.hostname === '127.0.0.1'
    )) {
      return
    }

    // Block external navigation and open in system browser instead
    event.preventDefault()
    shell.openExternal(navigationUrl)
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
    checkForUpdatesOnLaunch()
    if (pendingProtocolUrl && win && !win.isDestroyed()) {
      const url = pendingProtocolUrl
      pendingProtocolUrl = null
      setTimeout(() => handleProtocolUrl(url), 300)
    }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// IPC Handlers
ipcMain.handle('python-command', async (_event: any, { command, params }: { command: string, params: any }) => {
  return await pythonManager.sendCommand(command, params)
})

ipcMain.handle('upload-s3', async (event: any, { filePath, bucketName, key }: { filePath: string, bucketName: string, key: string }) => {
  const provider = String(process.env.STORAGE_PROVIDER || '').toLowerCase()
  const isHybrid = provider === 'hybrid'

  const onProgress = (progress: number) => {
    event.sender.send('upload-progress', { key, progress })
  }

  if (isHybrid) {
    console.log('[upload-s3] MinIO + S3 hybrid, key:', key)
    return await s3Manager.uploadFileHybrid(filePath, bucketName, key, onProgress)
  }

  return await s3Manager.uploadFile(filePath, bucketName, key, onProgress)
})

ipcMain.handle('python:install-deps', async (_event: any, { modules }: { modules: string[] }) => {
  const { execFile } = require('child_process')
  const pipName = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
  const toInstall = (modules || []).filter((name) => pipName.test(String(name || '').trim()))
  if (toInstall.length === 0) {
    throw new Error('No installable Python packages (bundled OIIO/OCIO/FFmpeg cannot be pip-installed).')
  }
  const pythonExe = pythonManager.pythonPath || (process.platform === 'win32' ? 'python' : 'python3')
  return new Promise((resolve, reject) => {
    console.log('[MAIN] Installing dependencies:', pythonExe, toInstall)
    execFile(pythonExe, ['-m', 'pip', 'install', ...toInstall], (err: any, stdout: string, stderr: string) => {
      if (err) {
        console.error('[MAIN] Pip failed:', stderr)
        reject(stderr || err.message)
      } else {
        console.log('[MAIN] Pip success:', stdout)
        resolve(stdout)
      }
    })
  })
})

ipcMain.handle('select-directory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  if (canceled) {
    return null
  } else {
    return filePaths[0]
  }
})

/** Open file dialog; returns absolute paths + names + sizes for staging (no missing .path from web File). */
ipcMain.handle('dialog:open-files', async () => {
  const winRef = win && !win.isDestroyed() ? win : BrowserWindow.getFocusedWindow() ?? undefined
  const options: Electron.OpenDialogOptions = {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media', extensions: ['exr', 'mp4', 'mov', 'mkv', 'avi', 'mxf', 'jpg', 'jpeg', 'png', 'tif', 'tiff', 'dpx'] },
      { name: 'All', extensions: ['*'] }
    ]
  }
  const { canceled, filePaths } = winRef
    ? await dialog.showOpenDialog(winRef, options)
    : await dialog.showOpenDialog(options)
  if (canceled || !filePaths?.length) return []
  const items: { filePath: string; fileName: string; size: number }[] = []
  for (const filePath of filePaths) {
    try {
      const stat = fs.statSync(filePath)
      if (stat.isFile()) {
        items.push({
          filePath,
          fileName: path.basename(filePath),
          size: stat.size
        })
      }
    } catch (_) { /* skip inaccessible */ }
  }
  return items
})

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.mkv', '.mxf', '.avi'])
const IMAGE_EXTS = new Set(['.exr', '.jpg', '.jpeg', '.png', '.tif', '.tiff', '.dpx'])
/** Delivery-supported extensions only (EXR, MOV, MP4, etc.). Others (.nk, .txt) are rejected. */
const DELIVERY_SUPPORTED_EXTS = new Set(['.exr', '.jpg', '.jpeg', '.png', '.tif', '.tiff', '.dpx', '.mp4', '.mov', '.mkv', '.mxf', '.avi'])
const SEQUENCE_REGEX = /^(.*?)(?:\.|_|-)?(\d+)\.(\w+)$/

interface ProcessPathsResult {
  items: { filePath: string; fileName: string; size: number; frameStart?: number; frameEnd?: number }[]
  unsupported: { fileName: string }[]
}

/** Scan a list of paths for sequences and single files. */
function processFileEntries(filePaths: string[]): { filePath: string; fileName: string; size: number; frameStart?: number; frameEnd?: number }[] {
  const results: { filePath: string; fileName: string; size: number; frameStart?: number; frameEnd?: number }[] = []

  // Track files by directory to handle grouping
  const dirMap = new Map<string, string[]>()
  for (const fp of filePaths) {
    const dir = path.dirname(fp)
    if (!dirMap.has(dir)) dirMap.set(dir, [])
    dirMap.get(dir)!.push(path.basename(fp))
  }

  dirMap.forEach((names, dirPath) => {
    type SeqEntry = { frame: number; name: string }
    const sequences = new Map<string, SeqEntry[]>()

    for (const name of names) {
      const ext = path.extname(name).toLowerCase()
      const fullPath = path.join(dirPath, name)

      let stat: fs.Stats
      try {
        stat = fs.statSync(fullPath)
        if (!stat.isFile()) continue
      } catch (_) { continue }

      if (VIDEO_EXTS.has(ext)) {
        results.push({ filePath: fullPath, fileName: name, size: stat.size })
        continue
      }

      if (IMAGE_EXTS.has(ext)) {
        const m = name.match(SEQUENCE_REGEX)
        if (m) {
          const prefix = m[1]
          const frame = parseInt(m[2], 10)
          const extPart = m[3]
          const key = `${prefix}\t${extPart}`
          if (!sequences.has(key)) sequences.set(key, [])
          sequences.get(key)!.push({ frame, name })
        } else {
          results.push({ filePath: fullPath, fileName: name, size: stat.size })
        }
      } else {
        // Other file types
        results.push({ filePath: fullPath, fileName: name, size: stat.size })
      }
    }

    sequences.forEach((entries) => {
      entries.sort((a, b) => a.frame - b.frame)
      const firstFrame = entries[0].frame
      const lastFrame = entries[entries.length - 1].frame
      const firstEntry = entries.find(e => e.frame === firstFrame) || entries[0]
      const firstPath = path.join(dirPath, firstEntry.name)

      let totalSize = 0
      for (const entry of entries) {
        try {
          totalSize += fs.statSync(path.join(dirPath, entry.name)).size
        } catch (_) { }
      }

      results.push({
        filePath: firstPath,
        fileName: firstEntry.name,
        size: totalSize,
        frameStart: firstFrame,
        frameEnd: lastFrame
      })
    })
  })

  return results
}

/** Open folder dialog and scan for EXR/video; returns { items, unsupported } for smart staging. */
ipcMain.handle('dialog:open-folder-files', async () => {
  const winRef = win && !win.isDestroyed() ? win : BrowserWindow.getFocusedWindow() ?? undefined
  const options: Electron.OpenDialogOptions = {
    properties: ['openDirectory']
  }
  const { canceled, filePaths } = winRef
    ? await dialog.showOpenDialog(winRef, options)
    : await dialog.showOpenDialog(options)
  if (canceled || !filePaths?.length) return { items: [], unsupported: [] }
  return processPathsOrFolders(filePaths)
})

// Queue Management IPC
ipcMain.handle('queue:get-jobs', async () => {
  return queueManager.getJobs()
})

ipcMain.handle('queue:add-job', async (_event: any, job: any) => {
  return queueManager.addJob(job)
})

ipcMain.handle('queue:update-job', async (_event: any, { id, updates }: { id: string, updates: any }) => {
  return queueManager.updateJob(id, updates)
})

ipcMain.handle('queue:remove-job', async (_event: any, id: string) => {
  return queueManager.deleteJob(id)
})

ipcMain.handle('queue:clear', async () => {
  return queueManager.clearCompleted()
})

ipcMain.handle('queue:purge', async () => {
  return queueManager.deleteAllJobs()
})

ipcMain.handle('queue:add-log', async (_event: any, { jobId, message }: { jobId: string, message: string }) => {
  const eventRow = queueManager.addJobLog(jobId, message, { component: 'renderer', event_type: 'log' })
  if (win && !win.isDestroyed()) {
    win.webContents.send('queue:log-appended', eventRow)
  }
  return eventRow
})

ipcMain.handle('queue:add-event', async (_event: any, payload: DBJobEventInput) => {
  const eventRow = queueManager.addJobEvent(payload)
  if (win && !win.isDestroyed()) {
    win.webContents.send('queue:log-appended', eventRow)
  }
  return eventRow
})

ipcMain.handle('queue:get-logs', async (_event: any, jobId: string) => {
  return queueManager.getJobLogs(jobId)
})

ipcMain.handle('queue:get-events', async (_event: any, { jobId, limit }: { jobId: string, limit?: number }) => {
  return queueManager.getJobEvents(jobId, limit ?? 1000)
})

ipcMain.handle('notify', async (_event: any, { title, body }: { title: string, body: string }) => {
  new Notification({ title, body }).show()
})

ipcMain.handle('open-external-url', async (_event: any, url: string) => {
  if (!url || typeof url !== 'string') {
    console.error('[open-external-url] Missing or invalid url:', url)
    throw new Error('open-external-url: url is required')
  }
  await shell.openExternal(url)
  return true
})

/** Renderer polls this after opening browser; returns OAuth code once when callback hits */
ipcMain.handle('auth:get-pending-code', () => {
  const code = pendingAuthCode
  pendingAuthCode = null
  return code ?? null
})

// Staging JSON: path + form data for deploy queue (Quick Publish → Queue)
const STAGING_PATH = path.join(app.getPath('userData'), 'staging.json')

ipcMain.handle('staging:read', async () => {
  try {
    const raw = fs.readFileSync(STAGING_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { items: [], formData: null }
  }
})

ipcMain.handle('staging:write', async (_event: any, data: { items: Array<{ filePath: string; fileName: string; size: number }>; formData: unknown }) => {
  fs.writeFileSync(STAGING_PATH, JSON.stringify(data, null, 2), 'utf-8')
  return true
})

ipcMain.handle('staging:clear', async () => {
  try {
    fs.unlinkSync(STAGING_PATH)
  } catch (_) { /* ignore */ }
  return true
})

ipcMain.handle('staging:process-files', async (_event: any, { filePaths }: { filePaths: string[] }) => {
  return processFileEntries(filePaths)
})

/** Process paths (files or folders): expand folders and detect sequences. Smart sequence vs single image. */
/** Recursively collect all file paths under a directory. */
function collectFilesRecursive(dirPath: string, out: string[]): void {
  try {
    const names = fs.readdirSync(dirPath)
    for (const name of names) {
      const fp = path.join(dirPath, name)
      try {
        const stat = fs.statSync(fp)
        if (stat.isDirectory()) {
          collectFilesRecursive(fp, out)
        } else if (stat.isFile()) {
          out.push(fp)
        }
      } catch (_) { /* skip inaccessible */ }
    }
  } catch (_) { /* skip invalid */ }
}

/** Process paths (files or folders): expand folders recursively, detect sequences, split supported vs unsupported. */
function processPathsOrFolders(paths: string[]): ProcessPathsResult {
  const allFilePaths: string[] = []
  for (const p of paths) {
    try {
      const stat = fs.statSync(p)
      if (stat.isDirectory()) {
        collectFilesRecursive(p, allFilePaths)
      } else {
        allFilePaths.push(p)
      }
    } catch (_) {
      /* skip invalid */
    }
  }
  const rawItems = processFileEntries(allFilePaths)
  const items: typeof rawItems = []
  const unsupported: { fileName: string }[] = []
  for (const item of rawItems) {
    const ext = path.extname(item.fileName).toLowerCase()
    if (DELIVERY_SUPPORTED_EXTS.has(ext)) {
      items.push(item)
    } else {
      unsupported.push({ fileName: item.fileName })
    }
  }
  return { items, unsupported }
}

ipcMain.handle('staging:process-paths-or-folders', async (_event: any, { paths }: { paths: string[] }) => {
  const { items, unsupported } = processPathsOrFolders(paths)
  return { items, unsupported }
})

// App settings (Thumbnail, GIF, MP4, General) — stored in userData/settings.json
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')

ipcMain.handle('settings:read', async () => {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
})

ipcMain.handle('settings:write', async (_event: any, data: object) => {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf-8')
  return true
})

app.on('window-all-closed', () => {
  pythonManager.stop()
  if (authCallbackServer) {
    authCallbackServer.close()
    authCallbackServer = null
  }
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.handle('app:get-temp-path', () => {
  return app.getPath('temp')
})

ipcMain.handle('app:ensure-dir', (_event: unknown, dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true })
  return dirPath
})

ipcMain.handle('video-metadata', async (_event: unknown, filePath: string) => {
  try {
    return await getVideoMetadata(filePath)
  } catch (err) {
    console.warn('[video-metadata]', err)
    return null
  }
})

ipcMain.handle('fs:delete-file', async (_event: any, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return true
  } catch (err) {
    console.error(`[FS] Failed to delete file ${filePath}:`, err)
    return false
  }
})

app.whenReady().then(() => {
  // Set cache directory to userData to avoid permission errors on Windows
  const cachePath = path.join(app.getPath('userData'), 'cache')
  try {
    if (!fs.existsSync(cachePath)) {
      fs.mkdirSync(cachePath, { recursive: true })
    }
    app.setPath('cache', cachePath)
  } catch (err) {
    console.warn('[main] Could not set cache path, using default:', err)
  }

  app.setAsDefaultProtocolClient('ctrack-publisher')
  startAuthCallbackServer()

  pythonManager.on('python-log', (msg) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('python-log', msg)
    }
  })

  pythonManager.start()
  createWindow()
  startAutoUpdater(() => (win && !win.isDestroyed() ? win : null))
})

ipcMain.handle('updater:check', async () => checkForUpdatesNow())
ipcMain.handle('updater:install', async () => installUpdateNow())
ipcMain.handle('app:get-version', async () => app.getVersion())

