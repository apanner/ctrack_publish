# CTrack Publisher – Desktop auth setup

The app **opens Google sign-in in your system browser**, then receives the success via a **local “CTrack Login success” page** (port 3847) and applies the session in the app.

---

## 1. Supabase Dashboard (required)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. **Authentication** → **URL Configuration**.
3. Under **Redirect URLs**, add **both** (Supabase must allow the exact URL the app uses):
   ```
   http://127.0.0.1:3847/auth/callback
   http://localhost:3847/auth/callback
   ```
4. Save.

**Why:** The app uses one of these as `redirectTo` (from `.env` or fallback). Supabase only returns an OAuth URL if the redirect is in this list. If it’s missing, you get no URL and the browser never opens.

---

## 2. Google Cloud Console

Google redirects to **Supabase**, not to localhost. So in Google you only need Supabase’s callback:

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Open the **OAuth 2.0 Client** used by Supabase.
3. Under **Authorized redirect URIs**, ensure you have:
   ```
   https://czwfeqheduofviockrab.supabase.co/auth/v1/callback
   ```
   (Use your real project ref if different.)

**Do not** add `http://localhost:3001/auth/callback` in Google; that is only in Supabase.

---

## 3. Flow

1. Start the app (Vite on port 3001, Electron window loads from it). The app also starts a small server on **port 3847** for the login callback.
2. Click **Sign in with Google** → your **default browser** opens and goes to Google.
3. Sign in (or use existing Google session) in the browser.
4. After sign-in, Supabase redirects the browser to **http://localhost:3847/auth/callback?code=...**.
5. The browser shows **“CTrack Publisher – Login successful. You can close this window.”** The Electron app receives the code, exchanges it for a session, and shows the main screen. You can close the browser tab.

---

## 4. If it still fails

- In Supabase, confirm **http://127.0.0.1:3847/auth/callback** and **http://localhost:3847/auth/callback** are in **Redirect URLs** and saved.
- Ensure no other app is using port 3847.
- If you see "No login URL received", check the console; Supabase may be returning an error.
- Restart the app and try again.
