# Handshake: ctrack_publish ↔ ctrack_v0

This document describes how **ctrack_publish** (Electron desktop app) integrates with **ctrack_v0** (Next.js web app). There is no separate `handshake.md` in the repo; this file is the integration report.

---

## 1. Shared Backend

| Concern | Implementation |
|--------|----------------|
| **Database** | Same Supabase project (`czwfeqheduofviockrab.supabase.co`) |
| **Auth** | Supabase Auth (e.g. Google OAuth). Same session/identity in both apps. |
| **Storage** | AWS S3 bucket `ctrack-storage` for published media (MP4, thumbnails). ctrack_v0 can use S3 or GDrive via `storage-service-factory`. |

Publish uses **Vite env**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (in `.env`). ctrack_v0 uses `NEXT_PUBLIC_SUPABASE_*`. Same values = same backend.

---

## 2. Data Flow (Publish → ctrack_v0)

1. **Artist runs ctrack_publish** (Electron): picks Project / Shot (and optionally Task) from dropdowns.
2. **Data for dropdowns** comes from Supabase in publish: `projects`, `shots`, `shot_tasks` via `use-ctrack-data.ts` (same tables as ctrack_v0).
3. **Publish flow**: drag file → transcode (Python/FFmpeg) → upload MP4 to S3 → **insert row into `shot_versions`**.
4. **ctrack_v0** shows that version in the shot’s Versions tab (reads `shot_versions` via `versions-service.ts`).

So the **handshake** is: publish writes into `shot_versions`; ctrack_v0 reads from it. No separate API between the two apps—they share the DB.

---

## 3. Schema Contract: `shot_versions`

Publish must insert only columns that exist in ctrack_v0’s schema and satisfy NOT NULL / FKs.

| Column | Required | Source in Publish |
|--------|----------|--------------------|
| `shot_id` | ✅ | Context (user-selected shot) |
| `project_id` | ✅ | Context (user-selected project) |
| `version_number` | ✅ | Computed (max + 1 per shot) |
| `submitted_by` | ✅ | Supabase Auth `session.user.id` |
| `submitted_at` | default | `now()` |
| `status` | default | e.g. `'Pending Review'` |
| `file_url` or `video_path` | — | S3 public URL of the published MP4 |

**Note:** `shot_versions` in ctrack_v0 has **no `task_id`** column. Publish uses task only for UI (which task context); the version is linked to shot/project only in the DB. If ctrack_v0 later adds `task_id` to `shot_versions`, publish can then include it.

---

## 4. Auth (Google sign-in on port 3001)

- **Flow**: User clicks “Sign in with Google” → app opens the OAuth URL in the **system default browser** (Chrome, Edge, etc.). User signs in there (or reuses existing Google session). Google redirects to `ctrack-publisher://auth/callback?code=...` → OS opens CTrack Publisher with that URL → app exchanges the code for a session and the user is logged in.
- **Redirect URL**: The app uses the custom scheme `ctrack-publisher://auth/callback`. You must add this in **Supabase** only (see `AUTH_SETUP_DESKTOP.md`). In **Google Cloud Console** you only need Supabase’s callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`), not the custom scheme.

## 5. Env and Run

- **Publish** (Electron):  
  - `.env`: `VITE_SUPABASE_*`, `AWS_*`, `AWS_S3_BUCKET_NAME` (or equivalent).  
  - Run: `npm run dev` (Vite + Electron; port 3001) or `Run_Ctrack_publish.bat` (Windows).  
  - From repo root: `cd ctrack_publish && npm run dev`.
- **ctrack_v0**:  
  - Same Supabase URL/anon key; optional S3/GDrive for storage.  
  - Run: `pnpm dev` / Docker as per project docs.

---

## 6. Summary

- **handshake** = shared Supabase DB + same auth; publish inserts into `shot_versions` with `shot_id`, `project_id`, `submitted_by`, `version_number`, and media URL (`file_url` / `video_path`); ctrack_v0 reads and displays those versions. No `handshake.md` existed before; this file is the report.
