import { useCallback, useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Toaster, toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { AppShell } from "@/components/layout/AppShell"
import { UpdatePrompt } from "@/components/update-prompt"

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
      <UpdatePrompt />
      <Toaster position="bottom-right" richColors theme="dark" />
    </>
  )
}

export default App
