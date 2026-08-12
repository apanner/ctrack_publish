# OAuth Flow Debugging Guide

## Complete Flow (with new logging)

```
1. Click "Sign in with Google" in Electron app
   ↓
2. Browser opens with Google OAuth URL (from Supabase)
   ↓
3. User signs in with Google account
   ↓
4. Google redirects to: http://127.0.0.1:3847/auth/callback?code=...
   ↓
5. Electron callback server (port 3847) receives request
   → [Check logs] "[auth-callback-server] Request received: /auth/callback?code=..."
   → [Check logs] "[auth-callback-server] Parsed - code: YES"
   → [Check logs] "[auth-callback-server] Sending auth-callback-code to renderer"
   ↓
6. Browser shows "Login successful. Closing in 3 seconds..."
   ↓
7. Electron sends code to React app via IPC channel "auth-callback-code"
   ↓
8. React App receives code
   → [Check logs] "[App] auth-callback-code received: YES"
   → [Check logs] "[App] Exchanging code for session..."
   ↓
9. Supabase exchanges code for session
   ↓
10. App updates session cache and shows main screen

```

## Where the Flow Can Break

### 1. Browser callback server not receiving request
- **Log check:** Look for `[auth-callback-server] Request received:`
- **If missing:** Browser never reached localhost:3847
  - Verify Supabase Redirect URL includes `http://127.0.0.1:3847/auth/callback`
  - Check firewall not blocking port 3847
  - Verify the URL in browser matches the callback URL

### 2. Code not parsed from URL
- **Log check:** Look for `[auth-callback-server] Parsed - code:`
- **If says "NO":** Supabase returned an error instead of code
  - Check browser URL for `?error=...` parameter
  - Verify Google provider is enabled in Supabase
  - Verify Google OAuth credentials are correct

### 3. Code not sent to renderer
- **Log check:** Look for `[auth-callback-server] Sending auth-callback-code to renderer`
- **If missing:** Window is null or destroyed
  - Verify Electron window is still open when callback arrives
  - Check if window was closed after clicking sign in

### 4. React app not receiving IPC message
- **Log check:** Look for `[App] auth-callback-code received:`
- **If missing:** IPC listener never got the message
  - Verify preload.ts exposes ipcRenderer correctly
  - Check DevTools console for any IPC errors
  - Verify React app hasn't been refreshed/navigated

### 5. Code exchange fails at Supabase
- **Log check:** Look for `[App] Exchange failed:`
- **If present:** Supabase rejected the code
  - May be expired (code is only valid for ~10 minutes)
  - PKCE state mismatch (shouldn't happen, but can)
  - Try signing in again

## How to Debug

### Step 1: Open Electron DevTools
- Press **F12** in the Electron window
- Click **Console** tab

### Step 2: Sign in with Google
1. Click "Sign in with Google"
2. System browser opens
3. Sign in with Google account
4. Watch both consoles:
   - **Electron Terminal**: Look for `[auth-callback-server]` logs
   - **DevTools Console**: Look for `[App]` logs

### Step 3: Check Console Output

**Success looks like:**
```
[auth-callback-server] Server listening on 127.0.0.1:3847
[auth-callback-server] Request received: /auth/callback?code=16be7bdc...
[auth-callback-server] Parsed - code: YES error: NO win exists: true win destroyed: false
[auth-callback-server] Sending auth-callback-code to renderer

(then in DevTools console)
[App] auth-callback-code received: YES
[App] Exchanging code for session...
[App] Exchange successful, session: YES
[App] Sign in complete, showing success toast
```

**Failure examples:**

```
# Callback server not receiving request
[auth-callback-server] Server listening on 127.0.0.1:3847
(nothing after that when you sign in)
→ Browser is not reaching localhost:3847, check redirect URL in Supabase

# IPC listener not set up
[auth-callback-server] Sending auth-callback-code to renderer
(nothing in DevTools console)
→ React app's IPC listener is not registered, check preload.ts

# Code exchange fails
[App] Exchange failed: ...error message...
→ Supabase rejected the code, may be expired or config issue
```

## Verification Checklist

- [ ] Supabase Redirect URLs include `http://127.0.0.1:3847/auth/callback`
- [ ] Google provider is enabled in Supabase → Providers
- [ ] Google OAuth credentials (Client ID / Secret) are set in Supabase
- [ ] `.env` has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Electron window stays open during sign-in
- [ ] No firewall blocking localhost:3847
- [ ] Browser callback page shows "Login successful"
