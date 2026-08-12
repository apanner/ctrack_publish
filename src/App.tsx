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
        invoke: (ch: string) => Promise<string | null>
        on: (ch: string, fn: (_: unknown, code: string) => void) => (() => void) | void
      }
    }
    if (!w.ipcRenderer) return
    const onCode = (_: unknown, code: string) => void handleAuthCode(code)
    const unsubscribe = w.ipcRenderer.on("auth-callback-code", onCode)
    const interval = setInterval(() => {
      if (codeHandledRef.current) return
      w.ipcRenderer!.invoke("auth:get-pending-code").then(handleAuthCode)
    }, 400)
    return () => {
      if (typeof unsubscribe === "function") unsubscribe()
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
