# CTrack Publisher (Electron)

Desktop publish app for CTrack studios. Google login, queue, transcode, S3/MinIO upload — same Supabase project as **ctrack_v0**.

## Artist flow

1. In **ctrack_v0**, click **Publisher** (top-right).
2. If installed → app opens via `ctrack-publisher://open`.
3. If not → download **CTrack-Publisher-Setup.exe** (all-in-one, no system tray).
4. Sign in with Google once → publish by studio.
5. Later builds: app **auto-updates** from GitHub Releases (no re-download from the website).

Download (latest):  
https://github.com/apanner/ctrack_publish/releases/latest/download/CTrack-Publisher-Setup.exe

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
