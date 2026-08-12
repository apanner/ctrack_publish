# Queue Workflow — What Happens When You Hit Publish

This document describes the **current workflow** from the moment you click **Publish** (Element or Version) until the job completes or fails.

---

## 1. Publish Button Click (Quick Publish view)

When you click **Publish Element** or **Publish Version**:

1. **Payload is built** from:
   - Context: `projectId`, `shotId`, `taskId` (Version only)
   - Active tab: `element` or `version`
   - Form: element label/notes/category/type, or version type/notes/version name
   - Staged files: `filePath`, `fileName`, `size`, optional `frameStart`/`frameEnd` for sequences

2. **Payload is logged**:
   - `console.log("[Publish] payload:", JSON.stringify(payload, null, 2))`
   - App log: `Publish: project=… shot=… tab=… files=…`

3. **One queue job per staged file** is added:
   - Each job gets: `filePath`, `context` (projectId, shotId, taskId), `meta` (tab, labels, notes, delivery type, etc.)
   - Jobs are written to SQLite (`ctrack_queue.db`) and to in-memory queue state

4. **Staging is cleared**: staged list and `staging.json` are cleared; UI navigates to **Queue** tab

5. **Processing starts automatically** (after ~100 ms):
   - For each new job ID:
     - **Element tab** → `startPublishElement(id, { elementLabel, elementNotes })`
     - **Version tab** → `startPublish(id)`

---

## 2. Version Publish Flow (`startPublish`)

For each **Version** job the following steps run in order:

| Step | Status | Progress | Action |
|------|--------|----------|--------|
| 1 | `transcoding` | 10% | **Python transcode**: EXR/video → MP4 (libx264, CRF 20, optional burn-in). Input: `job.filePath`; output: `job.filePath + ".mp4"`. |
| 2 | `transcoding` | 30% | **Python GIF** (if not disabled): generate preview GIF from input (fps=5, scale 480px). Output: `job.filePath + ".gif"`. |
| 3 | `uploading` | 50% | **S3 upload**: upload the MP4 to bucket `ctrack-storage`, key `publishes/{timestamp}_{filename}`. |
| 4 | `submitting` | 90% | **Supabase**: insert into `shot_versions` (shot_id, project_id, version_number, file_url, video_path, status, submitted_by, submitted_at). Version number = max(version_number)+1 for that shot. |
| 5 | `completed` | 100% | Native notification: "Publish Complete". |

- **On error**: job status → `error`, error message stored; notification "Publish Failed"; log written.

---

## 3. Element Publish Flow (`startPublishElement`)

For each **Element** job:

| Step | Status | Progress | Action |
|------|--------|----------|--------|
| 1 | `uploading` | 20% | **If video** (mp4/mov/avi/mkv): Python transcode → MP4, then S3 upload to `elements/{timestamp}_{filename}`. **If not video**: direct S3 upload of the file (e.g. EXR). |
| 2 | `submitting` | 90% | **Supabase**: insert into `shot_elements` (shot_id, project_id, category, element_type, name, description, url, format, created_by). |
| 3 | `completed` | 100% | Native notification: "Element published". |

- **On error**: job status → `error`; notification "Publish failed"; log written.

---

## 4. Queue Tab Behaviour

- **Queue list**: shows all jobs (idle, transcoding, uploading, submitting, completed, error) with progress and context.
- **Per-job Start**: clicking play on an idle job runs `handleStartJob(job)` → Element → `startPublishElement`, Version → `startPublish`.
- **Process all**: starts every idle job in order (each via `handleStartJob`).
- **Clear finished**: removes completed jobs from UI and deletes them from SQLite.

---

## 5. Data Flow Summary

```
[Quick Publish]  →  Build payload  →  Log  →  Add N jobs to queue (SQLite + state)
       →  Clear staging  →  Navigate to Queue  →  Start each job (transcode/upload/DB)

[Version job]  →  Transcode (Python/FFmpeg)  →  GIF (optional)  →  S3 upload  →  shot_versions insert
[Element job] →  Transcode if video else direct upload  →  S3 upload  →  shot_elements insert
```

---

## 6. Dependencies

- **Python sidecar**: `engine.py` — commands `transcode`, `gif`, `thumbnails`, `scan_folder`.
- **FFmpeg**: used by Python for transcode (MP4), GIF, thumbnails.
- **S3**: configured via app (bucket `ctrack-storage`); upload progress sent to renderer.
- **Supabase**: `shot_versions`, `shot_elements`; auth user for `submitted_by` / `created_by`.

---

## 7. Settings (Thumbnail, GIF, MP4, General)

Settings are stored in **userData/settings.json** and applied when running transcode and GIF steps.

| Section   | What it controls |
|----------|-------------------|
| **Thumbnail** | Width, height (0 = auto), format (JPG/PNG), quality, frame (first/middle/last). Used when generating thumbnails (e.g. bulk ingest / thumbnails command). |
| **GIF**       | Width (px), FPS, duration (sec), scale filter (lanczos/bicubic). Used for preview GIF in Version publish. |
| **MP4**       | Codec (libx264/libx265), CRF, preset, max width/height (0 = source), burn-in on/off, pixel format. Used for transcode to delivery MP4. |
| **General**    | Default S3 bucket, FFmpeg path (empty = system). |

- **Save settings** writes to disk; **Reset to defaults** restores built-in defaults.
- The publish queue reads settings before each transcode/GIF call and passes the relevant options to the Python side.

---

## 8. Plans (VFX studio manager)

- **Settings tab**: Implemented — Thumbnail, GIF, MP4, General with size/codec/preset/CRF and persistence.
- **Thumbnail command**: Python `thumbnails` already exists; can be wired to use Settings (width, format, quality, frame) when called from bulk ingest or future UI.
- **Default bucket**: General.defaultBucket can be used in S3 upload calls instead of hardcoded `ctrack-storage` when desired.
- **FFmpeg path**: General.ffmpegPath can be passed to Python so it uses a specific FFmpeg binary (e.g. studio-installed version).
- **EXR metadata**: Pass frame_start/frame_end from staging into shot_versions/shot_elements when publishing sequences.
- **Notifications**: Optional “Notify” recipients and version_submitted notifications as per handshake plan.
