# Handshake Plan: Publisher ↔ CTrack v0

**Smart tabs:** one form with two tabs — **Element** and **Version**. Only the active tab’s fields and one **Publish** button are shown. Version numbering is automatic from DB (v001, v002…); elements use a simple label (v001…). Optional **Override version numbers** checkbox allows editing version/element info when needed.

---

## 0. Version & Element Numbering

| Path    | Version / label | Default behaviour | Override |
|---------|------------------|-------------------|----------|
| **Version** | v001, v002, … | **Automatic**: next `version_number` from DB per shot; display as v001, v002 (zero-padded). | ☐ **Override version numbers** → version info field becomes editable (e.g. v003). |
| **Element** | v001, v002, … | **Starts at v001**: simple display label for elements (not a DB sequence; or use display_order / count). Editable by default. | N/A (always editable). |

- **Version tab**: Version info shows e.g. **v001** (from `max(version_number)+1`). If user checks **Override version numbers**, the field is editable and that value is stored as `version_name` (DB `version_number` still computed for uniqueness if needed, or allow manual only when override).
- **Element tab**: Version info shows **v001** (or next vNNN); user can change to v002, etc. Stored as display name / metadata or in `name`; no `version_number` in shot_elements.

---

## 1. GUI: Smart Tabs (Simplified)

One screen with **two tabs**. Shared at top: **Project** and **Shot** (so one place to pick context). Rest of the form depends on the selected tab.

### 1.1 Tab: **Element**

Visible only when **Element** tab is selected.

| # | Field | Source | UI |
|---|--------|--------|-----|
| 1 | Project | `projects` | Dropdown |
| 2 | Shot | `shots` | Dropdown |
| 3 | File | User | **Drag & drop or file/folder selection** (MP4, EXR) |
| 4 | Element type | — | Dropdown: **Plate \| Edit ref \| Other** |
| 5 | Notes | User | Short notes (e.g. “Plate”) → `description` or notes |
| 6 | Notify | `profiles` (supervisor, manager, production, admin) | Checkboxes (optional for elements) |
| 7 | Version info | User | **v001** (editable; default v001, then v001, …) |
| 8 | — | — | **Publish** button |

**Backend (Element):** Collect **EXR start frame**, **end frame**, **exr path** from selection when applicable. Store in `shot_elements`: url/storage_path, **exr_path**, **frame_start**, **frame_end**, name, element_type, category (media/document from file type), format, created_by.

---

### 1.2 Tab: **Version**

Visible only when **Version** tab is selected.

| # | Field | Source | UI |
|---|--------|--------|-----|
| 1 | Project | `projects` | Dropdown |
| 2 | Shot | `shots` | Dropdown |
| 3 | File | User | **Drag & drop or file/folder selection** (MP4, EXR) |
| 4 | Version type | — | **First Pass \| WIP \| Final** → `delivery_type` |
| 5 | Version task | `shot_tasks` | Dropdown (single task for context) |
| 6 | Notes template | User | Done / To Do / Question / Notification → `shot_versions.notes` |
| 7 | Version info | DB + override | **v001** (auto from DB). ☐ **Override version numbers** → editable |
| 8 | Notify | `profiles` | Checkboxes |
| 9 | — | — | **Publish** button |

**Backend (Version):** Collect **EXR start frame**, **end frame**, **exr path** when applicable. Store in `shot_versions`: file_url, video_path, **exr_path**, **exr_start_frame**, **exr_end_frame** (or frame_start/frame_end where present), version_number (auto or from override), version_name, notes, delivery_type, submitted_by. Optionally create **notes** row (note_type 'publisher') and **notifications** (version_submitted).

---

## 2. Example Layout (Publisher)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CTrack Publisher                                                    [user]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ Project ▼ ]    [ Shot ▼ ]                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│   [ Element ]    [ Version ]     ← Smart tabs: only active tab content below   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ─── Element tab ─────────────────────────────────────────────────────     │
│   File:          [ Drag & drop or select ]   (MP4 / EXR)                     │
│   Element type:  [ Plate ▼ ]   (Plate | Edit ref | Other)                    │
│   Notes:         Plate A — key frames only                                   │
│   Notify:        [✓] Jane  [ ] Bob  [ ] Alice                                │
│   Version info:  v001          (editable)                                  │
│                  [ Publish ]                                                 │
│   ─────────────────────────────────────────────────────────────────────     │
│                                                                             │
│   ─── Version tab ─────────────────────────────────────────────────────     │
│   File:          [ Drag & drop or select ]   (MP4 / EXR)                     │
│   Version type:  [ First Pass ]  [ WIP ]  [ Final ]                          │
│   Version task:  [ Comp ▼ ]     (dropdown from shot_tasks)                   │
│   Notes:         Done: ...  To Do: ...  Question: ...  Notification: ...   │
│   Version info:  v001            ☐ Override version numbers  (editable)     │
│   Notify:        [✓] Jane  [✓] Bob  [ ] Alice                                │
│                  [ Publish ]                                                 │
│   ─────────────────────────────────────────────────────────────────────     │
│                                                                             │
│   [ Queue / job list when multiple files ]                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

- Project and Shot are shared; one tab (Element or Version) is active; only that tab’s fields and one Publish button are shown.
- Version tab: version info defaults to next v001, v002…; checkbox makes it editable.
- Element tab: version info defaults to v001 (or next vNNN), always editable.

---

## 3. Backend: EXR Metadata (Both Paths)

Publisher should collect and send for **both** Version and Element when the selection is EXR (or has frame range):

| Collected | Version → shot_versions | Element → shot_elements |
|-----------|--------------------------|--------------------------|
| EXR path (dir or pattern) | `exr_path` | `exr_path` |
| EXR sequence pattern | `exr_sequence_pattern` | `exr_sequence_pattern` |
| Start frame | `exr_start_frame` (or frame_start) | `frame_start` |
| End frame | `exr_end_frame` (or frame_end) | `frame_end` |

- **shot_versions** already has: exr_path, exr_sequence_pattern, exr_start_frame, exr_end_frame, frame_count (migration 032).
- **shot_elements** already has: frame_start, frame_end. **New:** exr_path, exr_sequence_pattern (migration **049_shot_elements_exr_path.sql**).

---

## 4. DB Changes (CTrack v0)

### 4.1 shot_elements (Elements tab)

**New migration:** `049_shot_elements_exr_path.sql`

| Column | Type | Purpose |
|--------|------|---------|
| `exr_path` | TEXT | EXR path from publisher (or web upload) |
| `exr_sequence_pattern` | TEXT | e.g. shotname.%04d.exr |

Existing: frame_start, frame_end, url, storage_path, name, element_type, category, format, created_by. No change to RLS.

### 4.2 shot_versions (Versions tab)

Already has exr_path, exr_sequence_pattern, exr_start_frame, exr_end_frame, frame_count. **No migration needed.** Publisher sends these; CTrack Versions list shows them.

### 4.3 CTrack list views (to show in UI)

- **Versions tab (table):** Include columns (if not already): Version, Version name, File/Video, **EXR path**, **Start frame**, **End frame**, Submitted by, Type, Status, Notes, Actions.
- **Elements tab (Media/Documents tables):** Include columns: Name, Type, Format, **EXR path**, **Start frame**, **End frame**, Link/URL, Uploaded, Actions.

---

## 5. DB Contract Summary

### 5.1 Version path → shot_versions (Versions tab)

| Publisher | DB column | Notes |
|-----------|-----------|--------|
| Project + Shot | shot_id, project_id | Required |
| File → S3 | file_url, video_path | Required |
| EXR metadata | exr_path, exr_sequence_pattern, exr_start_frame, exr_end_frame | When EXR selected |
| Version info | version_number (auto), version_name (e.g. v001) | Auto from DB; editable if Override |
| Auth user | submitted_by | Required |
| Version type | delivery_type | WIP, Final, Client Review |
| Version task | — | UI/context only (no task_id on shot_versions unless added later) |
| Notes template | notes | Optional |
| Notify | notifications | One row per recipient, type 'version_submitted' |

### 5.2 Element path → shot_elements (Elements tab)

| Publisher | DB column | Notes |
|-----------|-----------|--------|
| Project + Shot | shot_id, project_id | Required |
| File → S3 | url, storage_path | Required |
| EXR metadata | **exr_path**, **exr_sequence_pattern**, frame_start, frame_end | From new migration + existing |
| Element type | element_type | plate, edit_ref, other |
| Name / label | name | From filename or version info (v001) |
| Category | category | media \| document (from file type) |
| Notes | description | Optional |
| Version info | — | Display only (v001); can be part of name or metadata |
| created_by | created_by | Auth user |

---

## 6. Implementation Plan

1. **DB (ctrack_v0)**  
   - Run migration **049_shot_elements_exr_path.sql** (add exr_path, exr_sequence_pattern to shot_elements).

2. **Publisher GUI**  
   - **Smart tabs:** Element | Version at top. Shared: Project, Shot.  
   - **Element tab:** File (drag/drop or select), Element type, Notes, Notify, Version info (v001 editable), Publish.  
   - **Version tab:** File (drag/drop or select), Version type, Version task dropdown, Notes template, Version info (v001 auto), ☐ Override version numbers, Notify, Publish.

3. **Publisher backend**  
   - **Version:** Compute next version_number per shot; show as v001. If Override checked, use edited value as version_name (and optionally version_number if you allow manual). Send exr_path, exr_start_frame, exr_end_frame when EXR. Insert shot_versions; optionally notes + notifications.  
   - **Element:** Send exr_path, frame_start, frame_end when EXR. Insert shot_elements (with new exr_path, exr_sequence_pattern). Version info v001/v001 is display/name only.

4. **CTrack v0 list views**  
   - **Versions tab:** Add/ensure columns for exr_path, start frame, end frame in table view.  
   - **Elements tab:** Add/ensure columns for exr_path, start frame, end frame in Media/Documents table views.

5. **Optional**  
   - Notify on Element publish (if you add it): re-use same profiles list and optionally write to notifications with a dedicated type (e.g. element_added) if you add that later.

---

## 7. Quick Reference

- **Element tab:** Project → Shot → File → Element type → Notes → Notify → Version info (v001) → **Publish**.  
  Backend: collect EXR start/end/path; store in shot_elements (+ exr_path, exr_sequence_pattern).

- **Version tab:** Project → Shot → File → Version type → Version task → Notes template → Version info (v001 auto, ☐ Override) → Notify → **Publish**.  
  Backend: version_number from DB; collect EXR start/end/path; store in shot_versions; optional notes + notifications.

- **DB:** shot_versions already has EXR fields; shot_elements gets exr_path and exr_sequence_pattern via migration 049. Both paths and both CTrack list views (Versions and Elements) show exr path and frame range where relevant.

---

## 8. Implementation status (Quick Publish)

- **ContextBar:** Simplified to Project + Shot only (no Task, Category, Element type, Ver in bar).
- **Smart tabs:** Element | Version tabs; only the active tab’s form is shown.
- **Element tab:** Drop zone (shared) + Category, Element type, Notes, Version info (v001 editable), Notify checkboxes, **Publish Element** button. Backend: `startPublishElement` uploads and inserts into `shot_elements`.
- **Version tab:** Drop zone (shared) + Version type (WIP / Final / Client Review), Version task dropdown, Notes template, Version info (v001 auto from DB), ☐ Override version numbers, Notify checkboxes, **Publish Version** button. Backend: existing `startPublish` inserts into `shot_versions`.
- **StagingZone:** Accepts optional `publishLabel` and `onPublishClick` so the main button label and action match the active tab.
- **Hooks:** `useNotificationRecipients`, `useNextVersionNumber` added for notify list and version display.
- **Optional next:** Pass notes, delivery_type, version_name into `shot_versions` insert; create notifications on Version publish; collect EXR frame/path for both paths.
