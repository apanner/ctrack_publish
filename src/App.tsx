import { useCallback, useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Toaster, toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { AppShell } from "@/components/layout/AppShell"

const AUTH_QUERY_KEYS = { session: ["auth", "session"] as const, user: ["auth", "user"] as const }

function App() {
  const queryClient = useQueryClient()
  const codeHandledRef = useRef(false)

  /** Handle OAuth code: from main push (auth-callback-code) or poll (auth:get-pending-code) */
  const handleAuthCode = useCallback(
    async (code: string | null) => {
      if (!code || typeof code !== "string" || codeHandledRef.current) return
      codeHandledRef.current = true
      toast.info("Completing sign in…", { duration: 5000 })
      try {
        const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) throw error
        queryClient.setQueryData(AUTH_QUERY_KEYS.session, session)
        if (session?.user) {
          await queryClient.refetchQueries({ queryKey: AUTH_QUERY_KEYS.user })
        }
        toast.success("Signed in successfully")
      } catch (err) {
        codeHandledRef.current = false
        toast.error(err instanceof Error ? err.message : "Sign in failed")
      }
    },
    [queryClient]
  )

  useEffect(() => {
    const w = window as unknown as {
      ipcRenderer?: {
        invoke: (ch: string, ...args: unknown[]) => Promise<unknown>
        on: (ch: string, fn: (_: unknown, ...args: unknown[]) => void) => (() => void) | void
      }
    }
    if (!w.ipcRenderer) return
    const onCode = (_: unknown, ...args: unknown[]) => void handleAuthCode(String(args[0] ?? ""))
    const unsubscribe = w.ipcRenderer.on("auth-callback-code", onCode)
    const interval = setInterval(() => {
      if (codeHandledRef.current) return
      w.ipcRenderer!.invoke("auth:get-pending-code").then((code) => handleAuthCode(code as string | null))
    }, 400)

    const onUpdate = (_: unknown, ...args: unknown[]) => {
      const payload = (args[0] || {}) as { status?: string; version?: string; percent?: number; message?: string }
      if (payload?.status === "available") {
        toast.info(`Update ${payload.version} found — downloading…`)
      } else if (payload?.status === "downloading" && typeof payload.percent === "number") {
        toast.message(`Downloading update… ${Math.round(payload.percent)}%`)
      } else if (payload?.status === "ready") {
        toast.success(`Update ${payload.version} ready — restarting Publisher…`)
      } else if (payload?.status === "current") {
        toast.message(`Publisher ${payload.version} is up to date`)
      } else if (payload?.status === "error" && payload.message) {
        toast.error(`Update: ${payload.message}`)
      }
    }
    const unsubUpdate = w.ipcRenderer.on("updater:status", onUpdate)

    return () => {
      if (typeof unsubscribe === "function") unsubscribe()
      if (typeof unsubUpdate === "function") unsubUpdate()
      clearInterval(interval)
    }
  }, [handleAuthCode])

  return (
    <>
      <AuthGuard>
        <AppShell />
      </AuthGuard>
      <Toaster position="bottom-right" richColors theme="dark" />
    </>
  )
}

export default App
