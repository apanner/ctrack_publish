# CTrack Publisher (Electron)

Desktop publish app for CTrack studios. Google login, queue, transcode, S3/MinIO upload — same Supabase project as **ctrack_v0**.

## Install location

NSIS one-click install (per-user):

- App: `%LOCALAPPDATA%\Programs\CTrack Publisher\`
- Desktop + Start Menu shortcuts (CTrack icon)
- Protocol: `ctrack-publisher://open`

## Artist flow

1. In **ctrack_v0**, click **Publisher** (top-right).
2. If installed → app opens via `ctrack-publisher://open`.
3. If not → download **CTrack-Publisher-Setup.exe** (all-in-one, no system tray).
4. Desktop icon → app opens → **Sign in with Google** (Supabase URL/anon key are baked into the build; callback `http://127.0.0.1:3847/auth/callback`).
5. Later builds: app **auto-updates** from GitHub Releases.

Download (latest):  
https://github.com/apanner/ctrack_publish/releases/latest/download/CTrack-Publisher-Setup.exe

## Config (how auth/storage get into the installer)

Not a dumped `.env` in the repo.

| Layer | What | How |
|-------|------|-----|
| Google / Supabase UI | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_CALLBACK_URL` | GitHub Actions secrets → Vite bake at build |
| Storage (main) | AWS / hybrid MinIO keys | CI writes `resources/publisher-config.env` from secrets → packaged under `resources/` |
| Dev | local `.env` | Never committed; see `.env.example` |

Required Actions secrets: `VITE_SUPABASE_*`, `VITE_AUTH_CALLBACK_URL`, `STORAGE_PROVIDER`, `AWS_*`, `HYBRID_*`.

## Dev

```bash
npm ci
npm run dev
```

## Release

```bash
# bump version in package.json, then:
git tag v1.0.0
git push origin v1.0.0
# or: npm run build:publish  (needs GH_TOKEN)
```

CI: `.github/workflows/ctrack_publish_release.yml`

## Protocol

- `ctrack-publisher://open` — focus / launch app (used by ctrack_v0)
- Auth still uses `http://127.0.0.1:3847/auth/callback`
