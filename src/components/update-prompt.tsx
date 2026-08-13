import { useEffect, useState } from "react"
import { Download, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface UpdatePayload {
  status?: string
  version?: string
  percent?: number
  message?: string
}

export function UpdatePrompt() {
  const [payload, setPayload] = useState<UpdatePayload | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const ipc = (window as unknown as {
      ipcRenderer?: {
        invoke: (ch: string, ...args: unknown[]) => Promise<unknown>
        on: (ch: string, fn: (_: unknown, ...args: unknown[]) => void) => (() => void) | void
      }
    }).ipcRenderer
    if (!ipc) return

    void ipc.invoke("updater:check")

    const onStatus = (_: unknown, ...args: unknown[]) => {
      const next = (args[0] || {}) as UpdatePayload
      if (!next?.status) return
      setPayload(next)
      if (next.status === "available" || next.status === "ready") {
        setDismissed(false)
      }
    }
    const unsub = ipc.on("updater:status", onStatus)
    return () => {
      if (typeof unsub === "function") unsub()
    }
  }, [])

  const handleUpdate = async () => {
    if (payload?.status === "ready") {
      await (window as any).ipcRenderer?.invoke("updater:install")
      return
    }
    await (window as any).ipcRenderer?.invoke("updater:check")
  }

  const isActive =
    payload?.status === "available" ||
    payload?.status === "downloading" ||
    payload?.status === "ready"

  if (!isActive || dismissed) return null

  const version = payload?.version ? `v${payload.version}` : "a new version"
  const isReady = payload?.status === "ready"
  const isDownloading = payload?.status === "downloading"
  const percent = Math.max(0, Math.min(100, Math.round(payload?.percent || 0)))

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-6"
      role="alertdialog"
      aria-labelledby="update-title"
      aria-describedby="update-desc"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#24E1B1]/40 bg-[#1A1A1A] p-6 shadow-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#24E1B1]">
          CTrack Publisher
        </p>
        <h2 id="update-title" className="mt-2 text-xl font-bold text-white">
          New update available
        </h2>
        <p id="update-desc" className="mt-2 text-sm text-gray-300">
          {isReady
            ? `${version} is downloaded. Please restart to update.`
            : isDownloading
              ? `Downloading ${version}… ${percent}%`
              : `${version} is available. Please update to keep Publisher current.`}
        </p>
        {isDownloading && (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#333]">
            <div
              className="h-full rounded-full bg-[#24E1B1] transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="border-[#404040] bg-transparent text-gray-300 hover:bg-[#333] hover:text-white"
            onClick={() => setDismissed(true)}
          >
            Later
          </Button>
          <Button
            type="button"
            className="bg-[#24E1B1] text-[#121212] hover:bg-[#24E1B1]/90"
            onClick={() => void handleUpdate()}
            disabled={isDownloading}
          >
            {isReady ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Restart and update
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Update now
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
