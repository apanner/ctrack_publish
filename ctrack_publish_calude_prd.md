# CTrack Publish - Streamlined PRD

**Document Version**: 3.0 Simplified  
**Last Updated**: January 30, 2026  
**Status**: Ready for Implementation

---

## 📋 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Core Workflow](#2-core-workflow)
3. [Application Structure](#3-application-structure)
4. [Feature Requirements](#4-feature-requirements)
5. [UI Design & Layout](#5-ui-design--layout)
6. [Settings & Configuration](#6-settings--configuration)
7. [Technical Architecture](#7-technical-architecture)
8. [Development Phases](#8-development-phases)

---

## 1. Executive Summary

### 1.1 Product Vision

**CTrack Publish** is a streamlined desktop application that simplifies VFX asset submission. Artists drag media files, the app intelligently prepares them for review, and supervisors get notified instantly.

**Key Principle**: Make publishing as simple as drag → confirm → done.

### 1.2 The Simplified Problem

Current workflow pain points:
- Too many manual steps to publish a version
- Artists confused about which fields to fill
- No automated media preparation (thumbnails, GIFs, proxies)
- Bulk plate ingestion is completely manual

### 1.3 The Streamlined Solution

Three core modes:
1. **Quick Publish**: Drag EXR/MP4 → Auto-detect context → Publish
2. **Bulk Ingest**: Select folder → Detect sequences → Process all
3. **Queue Monitor**: Watch background processing + notifications

### 1.4 Success Metrics

- **Artist Time**: 5 min → 1 min per publish
- **Accuracy**: 95%+ auto-detection of shot context
- **Bulk Efficiency**: Process 100 plates in 2 hours unattended
- **Adoption**: 90% of artists within 3 months

---

## 2. Core Workflow

### 2.1 Application Entry

```
┌─────────────────────────────────────────────┐
│                                             │
│         🎬 Welcome to CTrack Publish        │
│                                             │
│     [🔐 Sign in with Google (C-Track)]     │
│                                             │
│         Secure OAuth Integration            │
│                                             │
└─────────────────────────────────────────────┘
```

**After Login**:
- App loads user profile from C-Track
- Fetches user's active projects
- Restores last session (if any queued items)

---

### 2.2 Main Workflow: Quick Publish

```
STEP 1: DRAG & DROP
User drags: render_v003.1001.exr (or entire folder)
         OR: final_comp_v2.mp4

↓

STEP 2: AUTO-DETECTION
App analyzes:
- File path: /shots/hero_film/sh010/comp/v003/
- Detected: Project=Hero Film, Shot=SH010, Task=Comp, Version=003
- File type: EXR sequence → Generate proxy needed
           MP4/MOV → Use as-is, extract thumbnail

↓

STEP 3: CONFIRMATION
Show user:
┌────────────────────────────────────┐
│ 🎯 DETECTED CONTEXT                │
│ Project: Hero Film                 │
│ Shot: SH010                        │
│ Task: Comp                         │
│ Version: 003                       │
│                                    │
│ [✓ Looks Good] [✏️ Edit Context]  │
└────────────────────────────────────┘

↓

STEP 4: ADD NOTES
┌────────────────────────────────────┐
│ Submission Notes:                  │
│ [Fixed edge artifacts per feedback]│
│                                    │
│ Notify: [☑️ Supervisor] [☐ Client]│
└────────────────────────────────────┘

↓

STEP 5: PUBLISH
[🚀 Publish to C-Track]

↓

STEP 6: BACKGROUND PROCESSING
Queue Item Added:
- Generate thumbnail (frame 50% mark)
- Generate animated GIF (10 frames, 2 fps)
- Generate MP4 proxy (if EXR)
- Upload to S3
- Update C-Track database
- Send notifications

↓

STEP 7: COMPLETION
✅ Published! Link: https://ctrack.studio/shots/sh010/v003
```

---

### 2.3 Bulk Ingest Workflow

```
STEP 1: SELECT FOLDER
User clicks: "Browse for Delivery Folder"
Selects: /deliveries/episode_105/plates/

↓

STEP 2: SCAN & DETECT
App scans recursively:
- Finds: sh010/, sh011/, sh012/, ...
- Each folder has: plate_v001.####.exr

Detection Results:
┌─────────────────────────────────────────┐
│ Found 89 sequences                      │
│                                         │
│ ☑️ sh010 - 240 frames ✅               │
│ ☑️ sh011 - 180 frames ✅               │
│ ☑️ sh012 - 156 frames ⚠️ (gaps!)      │
│ ☐ misc   - Invalid ❌                  │
│                                         │
│ [Select All Valid] [Review Selected]    │
└─────────────────────────────────────────┘

↓

STEP 3: CONFIGURE INGEST
┌─────────────────────────────────────────┐
│ Import Type: [Plates ▼]                │
│ Project: [Hero Film ▼]                 │
│ Auto-notify: [☑️ Supervisor]           │
│                                         │
│ Selected: 87 sequences                  │
│ Est. Time: 2h 15m                       │
└─────────────────────────────────────────┘

↓

STEP 4: PROCESS
[🚀 Start Bulk Ingest]

All 87 sequences added to queue
Processing 3 at a time (parallel)

↓

STEP 5: MONITOR
Queue tab shows real-time progress
```

---

## 3. Application Structure

### 3.1 Main Window Layout

```
┌──────────────────────────────────────────────────────────────┐
│ 🎬 CTrack Publish                          👤 Sarah K.  [⚙️] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [📄 Quick Publish]  [📦 Bulk Ingest]  [📊 Queue]           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                                                              │
│                    TAB CONTENT AREA                          │
│                                                              │
│                                                              │
│                                                              │
│                                                              │
│                                                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Three Tabs Only

1. **Quick Publish**: Single file/sequence publishing
2. **Bulk Ingest**: Multiple sequences from folder
3. **Queue**: Monitor all background processing

---

## 4. Feature Requirements

### 4.1 Authentication (F1) - Priority: P0

**What**: Google OAuth login using existing C-Track credentials

**Flow**:
1. App opens → "Sign in with Google" button
2. OAuth popup → User authenticates
3. App receives token → Validates with C-Track backend
4. Stores token securely (OS keychain)
5. Auto-refresh token before expiry

**User Experience**:
- First time: One-click Google sign-in
- Subsequent launches: Silent authentication (token still valid)
- Token expired: Automatic re-authentication prompt

---

### 4.2 Smart File Detection (F2) - Priority: P0

**What**: Automatically determine what type of media was dropped

**Detection Logic**:

**Input: EXR Sequence Folder**
```
User drops: /shots/film/sh010/comp/v003/
Contains: render.1001.exr, render.1002.exr, ...

App Detects:
- Type: Image Sequence
- Format: EXR
- Frames: 1001-1240 (240 total)
- Resolution: 1920x1080
- Missing: None ✅

Required Processing:
- Generate thumbnail (frame 1120)
- Generate GIF (10 frames: 1001, 1025, 1050...)
- Transcode to MP4 proxy
```

**Input: Single MP4/MOV**
```
User drops: final_comp_v2.mp4

App Detects:
- Type: Video File
- Format: MP4
- Duration: 10 seconds (240 frames @ 24fps)
- Resolution: 1920x1080

Required Processing:
- Extract thumbnail (frame 120)
- Generate GIF (10 frames)
- Use original as proxy (already compressed)
```

**Input: Mixed Folder**
```
User drops: /shots/film/sh010/
Contains: 
  - comp/v003/*.exr
  - plate/v001/*.exr
  - reference/v001.mp4

App Detects:
- Multiple sequences found
- Asks user: "Which one to publish?"
- Shows list with thumbnails
```

---

### 4.3 Context Auto-Detection (F3) - Priority: P0

**What**: Parse file paths to extract project, shot, task, version

**Pattern Matching**:

```yaml
Pattern Library (15 preset patterns):

# Standard VFX
- Pattern: /(?P<project>\w+)/(?P<shot>sh\d+)/(?P<task>\w+)/v(?P<version>\d+)/
  Example: /herofilm/sh010/comp/v003/
  Extracts: project=herofilm, shot=sh010, task=comp, version=003

# Sequence-based
- Pattern: /(?P<project>\w+)/sq(?P<seq>\d+)_sh(?P<shot>\d+)/
  Example: /starwars/sq01_sh050/
  Extracts: project=starwars, shot=sq01_sh050

# Episode-based
- Pattern: /(?P<project>\w+)/ep(?P<ep>\d+)/(?P<shot>\d+)/
  Example: /tvseries/ep105/010/
  Extracts: project=tvseries, shot=ep105_010

# Fallback: Filename
- Pattern: (?P<shot>sh\d+)_(?P<task>\w+)_v(?P<version>\d+)
  Example: sh010_comp_v003.mp4
  Extracts: shot=sh010, task=comp, version=003
```

**User Experience**:
```
Scenario A: High Confidence (95%+)
┌────────────────────────────────────┐
│ ✅ Auto-Detected:                  │
│ Project: Hero Film                 │
│ Shot: SH010                        │
│ Task: Comp                         │
│ Version: 003                       │
│                                    │
│ [Looks Good ✓] [Edit ✏️]          │
└────────────────────────────────────┘

Scenario B: Low Confidence (<70%)
┌────────────────────────────────────┐
│ ⚠️ Could Not Auto-Detect           │
│ Please manually select:            │
│                                    │
│ Project: [Select... ▼]            │
│ Shot: [Select... ▼]               │
│ Task: [Select... ▼]               │
│ Version: [003]                     │
└────────────────────────────────────┘

Scenario C: Partial Detection
┌────────────────────────────────────┐
│ 🤖 Detected:                       │
│ Project: Hero Film ✅              │
│ Shot: SH010 ✅                     │
│ Task: [Select... ▼] ⚠️            │
│ Version: 003 ✅                    │
└────────────────────────────────────┘
```

---

### 4.4 Media Processing Pipeline (F4) - Priority: P0

**What**: Generate thumbnails, GIFs, and MP4 proxies automatically

**Processing Steps**:

```
INPUT: EXR Sequence (240 frames)

STEP 1: Thumbnail Generation
- Select middle frame (frame 120)
- Extract to temp: /tmp/thumb_sh010_v003.exr
- Convert to JPEG: 1920x1080 → 800x450
- Apply color transform: Linear → sRGB
- Output: thumb_sh010_v003.jpg (50 KB)
- Time: ~2 seconds

STEP 2: Animated GIF Generation
- Select 10 evenly spaced frames: 1001, 1027, 1053, ...
- Extract each frame
- Resize to 640x360 (small file size)
- Create GIF: 10 frames @ 2 fps (5 second loop)
- Apply color transform
- Output: preview_sh010_v003.gif (500 KB)
- Time: ~10 seconds

STEP 3: MP4 Proxy Generation
- Transcode full sequence
- Codec: H.264, preset: medium
- Resolution: 1920x1080 (maintain)
- Bitrate: 5 Mbps (good quality, reasonable size)
- Frame rate: 24 fps (maintain)
- Color transform: Linear → Rec.709
- Add burnins (optional, from settings):
  - Top left: "SH010_comp_v003"
  - Bottom right: "Frame 1050/1240"
- Output: proxy_sh010_v003.mp4 (25 MB)
- Time: ~60 seconds (depends on CPU)

TOTAL TIME: ~72 seconds for 240 frames
```

**Processing for MP4/MOV Input**:
```
INPUT: final_comp_v2.mp4

STEP 1: Thumbnail
- Extract frame at 50% mark
- Convert to JPEG: thumb.jpg
- Time: <1 second

STEP 2: GIF
- Extract 10 frames
- Create GIF: preview.gif
- Time: ~3 seconds

STEP 3: Proxy
- Original MP4 is already compressed
- If resolution > 1920x1080: Re-encode to 1080p
- If resolution <= 1920x1080: Use original as proxy (skip)
- Time: 0-30 seconds
```

---

### 4.5 Cloud Upload & Database Update (F5) - Priority: P0

**What**: Upload to S3 and register in C-Track database

**S3 Upload Structure**:
```
s3://ctrack-media/
├── projects/
│   └── hero-film/
│       ├── plates/
│       │   └── sh010/
│       │       └── v001/
│       │           ├── original/  (EXR sequences, if kept)
│       │           ├── proxy.mp4
│       │           ├── thumbnail.jpg
│       │           └── preview.gif
│       └── shots/
│           └── sh010/
│               └── comp/
│                   └── v003/
│                       ├── proxy.mp4
│                       ├── thumbnail.jpg
│                       └── preview.gif
```

**Database Update**:
```sql
-- For Shot Versions (Comp, Render)
INSERT INTO shot_versions (
  project_id,
  shot_id,
  task_id,
  version_number,
  
  proxy_url,        -- S3 URL for MP4
  thumbnail_url,    -- S3 URL for JPEG
  preview_gif_url,  -- S3 URL for GIF
  
  source_path,      -- Original file path
  frame_range,      -- [1001, 1240]
  resolution,       -- [1920, 1080]
  file_size_bytes,
  
  artist_notes,     -- User-provided notes
  status,           -- 'pending_review'
  
  created_by,       -- User ID
  created_at
)

-- For Plates/Elements (Bulk Ingest)
INSERT INTO shot_elements (
  project_id,
  shot_id,
  element_type,     -- 'plate', 'element', 'reference'
  version_number,
  
  proxy_url,
  thumbnail_url,
  preview_gif_url,
  
  source_path,
  frame_range,
  metadata,         -- JSONB: camera info, etc.
  
  created_by,
  created_at
)
```

---

### 4.6 Notification System (F6) - Priority: P1

**What**: Notify supervisors and artists when versions are published

**Notification Types**:

**Email Notification** (via C-Track backend):
```
Subject: [Hero Film] New Version: SH010 Comp v003

Hi Lisa,

Sarah K. has submitted a new version for review:

Shot: SH010 - Hero Entry
Task: Comp
Version: v003

Notes: "Fixed edge artifacts per feedback"

View Version: https://ctrack.studio/shots/sh010/v003

---
Quick Actions:
[Approve] [Request Changes] [View in C-Track]
```

**In-App Notification** (C-Track Web):
```
🔔 New Version: SH010 Comp v003 from Sarah K.
   "Fixed edge artifacts per feedback"
   [View Now]
```

**Slack Notification** (optional, if integrated):
```
📽️ New submission in #hero-film-comp

Sarah K. published SH010 Comp v003
Notes: Fixed edge artifacts per feedback

View: https://ctrack.studio/shots/sh010/v003
```

**Who Gets Notified**:
```
Default Recipients:
- Shot Supervisor (always)
- Department Lead (always)
- Artist who submitted (confirmation)

Optional Recipients (checkbox in publish UI):
- Client (if enabled for project)
- Producer
- Additional team members
```

---

### 4.7 Queue Management (F7) - Priority: P0

**What**: Background processing with progress tracking

**Queue States**:
```
Job Lifecycle:

PENDING → Waiting in queue
   ↓
PROCESSING → Generating media
   ↓
UPLOADING → Uploading to S3
   ↓
FINALIZING → Updating database
   ↓
COMPLETE → Success! ✅

OR

FAILED → Error occurred ❌
   ↓
RETRY → Auto-retry (max 3 attempts)
```

**Queue Persistence**:
- Store in local SQLite database
- Survives app restart
- Failed jobs remain for manual retry
- Completed jobs auto-clear after 24 hours

---

### 4.8 Bulk Ingest (F8) - Priority: P0

**What**: Process 100+ sequences from delivery folders

**Workflow**:
```
STEP 1: Folder Selection
User clicks: "Browse Delivery Folder"
App opens: Native file picker
User selects: /deliveries/episode_105/plates/

STEP 2: Recursive Scan
App scans all subdirectories (max depth: 5)
Finds:
  /plates/sh010/v001/*.exr (240 frames)
  /plates/sh011/v001/*.exr (180 frames)
  /plates/sh012/v001/*.exr (156 frames, gaps!)
  /plates/misc/test.txt (ignored)

STEP 3: Pattern Matching
For each folder, try to extract:
- Shot code (sh010, sh011, ...)
- Version (v001)
- Element type (plates, elements, reference)

Detection Results:
┌────────────────────────────────────────────────┐
│ Shot    | Frames | Status    | Action         │
├────────────────────────────────────────────────┤
│ SH010   | 240    | ✅ Ready  | ☑️ Process    │
│ SH011   | 180    | ✅ Ready  | ☑️ Process    │
│ SH012   | 156    | ⚠️ Gaps   | ☐ Review      │
│ misc    | -      | ❌ Invalid| ☐ Ignore      │
└────────────────────────────────────────────────┘

STEP 4: Configuration
┌────────────────────────────────────────────────┐
│ Import As: [Plates ▼]                         │
│ Project: [Hero Film ▼]                        │
│ Auto-notify Supervisor: [☑️]                  │
│                                                │
│ Selected: 87 sequences                         │
│ Estimated Time: 2 hours 15 minutes            │
│ Estimated Storage: 245 GB                     │
└────────────────────────────────────────────────┘

STEP 5: Batch Processing
- Add all 87 sequences to queue
- Process 3 at a time (parallel workers)
- Each worker: thumbnail → GIF → MP4 → upload
- Update progress in Queue tab

STEP 6: Completion
- Send summary email to supervisor
- Show notification: "Bulk ingest complete: 87/87 successful"
```

**Special Handling**:
- **New Shots**: If shot doesn't exist in database, auto-create
- **Frame Gaps**: Show warning, allow user to proceed or skip
- **Duplicates**: If version already exists, show conflict warning

---

## 5. UI Design & Layout

### 5.1 Login Screen

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                                                          │
│                    🎬                                    │
│              CTrack Publish                              │
│                                                          │
│         Professional VFX Publishing Tool                 │
│                                                          │
│                                                          │
│         ┌──────────────────────────────────┐            │
│         │                                  │            │
│         │   🔐 Sign in with Google         │            │
│         │                                  │            │
│         └──────────────────────────────────┘            │
│                                                          │
│              Secure C-Track Integration                  │
│                                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘

Color Scheme:
- Background: Dark gray (#1a1a1a)
- Card: Slightly lighter gray (#2a2a2a)
- Button: Google blue (#4285f4)
- Text: White (#ffffff)
- Accent: Cyan (#00d4ff)
```

---

### 5.2 Tab 1: Quick Publish

```
┌────────────────────────────────────────────────────────────────┐
│ 🎬 CTrack Publish              👤 Sarah K.  [⚙️ Settings] [×] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  [📄 Quick Publish]  [📦 Bulk Ingest]  [📊 Queue]             │
│   ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                                            │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  DRAG & DROP ZONE                                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │                      📁                                  │ │
│  │                                                          │ │
│  │        Drag EXR sequence, MP4, or MOV here              │ │
│  │                                                          │ │
│  │              or click to browse files                    │ │
│  │                                                          │ │
│  │   Supports: .exr, .mp4, .mov                            │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│                                                                │
│  RECENT SUBMISSIONS                                            │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 🖼️ [thumb] SH010_comp_v003  ✅ Published  10 min ago    │ │
│  │ 🖼️ [thumb] SH009_comp_v005  ✅ Published  1 hour ago    │ │
│  │ 🖼️ [thumb] SH008_comp_v002  ⏳ Processing...            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘

Design Notes:
- Large, obvious drop zone (60% of screen height)
- Dashed border with hover effect (glowing cyan)
- Recent submissions show thumbnails + status
- Minimalist, uncluttered interface
```

**After File Drop**:

```
┌────────────────────────────────────────────────────────────────┐
│ 🎬 CTrack Publish              👤 Sarah K.  [⚙️ Settings] [×] │
├────────────────────────────────────────────────────────────────┤
│  [📄 Quick Publish]  [📦 Bulk Ingest]  [📊 Queue]             │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  PREVIEW                                                       │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │         [Thumbnail Preview - 800x450]                    │ │
│  │                                                          │ │
│  │  render_v003.####.exr                                   │ │
│  │  240 frames (1001-1240) • 1920x1080 • ACEScg           │ │
│  │  File Size: 2.4 GB                                      │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  CONTEXT                                                       │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 🤖 Auto-Detected:                                        │ │
│  │                                                          │ │
│  │ Project:   [Hero Film ▼]              ✅ Confident     │ │
│  │ Shot:      [SH010 ▼]                   ✅ Confident     │ │
│  │ Task:      [Comp ▼]                    ✅ Confident     │ │
│  │ Version:   [003]                        ✅ Confident     │ │
│  │                                                          │ │
│  │ [✏️ Edit Context Manually]                              │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  SUBMISSION DETAILS                                            │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Notes:                                                   │ │
│  │ ┌────────────────────────────────────────────────────┐  │ │
│  │ │ Fixed edge artifacts per supervisor feedback       │  │ │
│  │ │                                                     │  │ │
│  │ └────────────────────────────────────────────────────┘  │ │
│  │                                                          │ │
│  │ Notify:  [☑️ Supervisor]  [☑️ Dept Lead]  [☐ Client]   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│                                                                │
│               [Cancel]        [🚀 Publish]                     │
│                                                                │
└────────────────────────────────────────────────────────────────┘

Design Notes:
- Thumbnail shows first valid frame (auto-generated)
- Green checkmarks indicate high-confidence detection
- Edit button allows manual override if needed
- Notes field is prominent but not required
- Big green "Publish" button (call to action)
```

---

### 5.3 Tab 2: Bulk Ingest

```
┌────────────────────────────────────────────────────────────────┐
│ 🎬 CTrack Publish              👤 Sarah K.  [⚙️ Settings] [×] │
├────────────────────────────────────────────────────────────────┤
│  [📄 Quick Publish]  [📦 Bulk Ingest]  [📊 Queue]             │
│                       ▔▔▔▔▔▔▔▔▔▔▔▔▔                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  FOLDER SELECTION                                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │  Delivery Folder:                                        │ │
│  │  ┌────────────────────────────────────┐  [Browse...]    │ │
│  │  │ /deliveries/episode_105/plates     │                 │ │
│  │  └────────────────────────────────────┘                 │ │
│  │                                                          │ │
│  │  Import As:     [Plates ▼]                              │ │
│  │  Project:       [Hero Film ▼]                           │ │
│  │  Auto-notify:   [☑️ Supervisor on completion]           │ │
│  │                                                          │ │
│  │                            [🔍 Scan Folder]              │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  SCAN RESULTS                                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Found: 89 sequences  Valid: 87  Invalid: 2             │ │
│  │                                                          │ │
│  │  Filter: [All ▼]  [☑️ Select All Valid]                 │ │
│  │                                                          │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │ ☑️ │ 🖼️ │ SH010 │ 240 fr │ 1920x1080 │ ✅ Ready  │ │ │
│  │  ├────────────────────────────────────────────────────┤ │ │
│  │  │ ☑️ │ 🖼️ │ SH011 │ 180 fr │ 1920x1080 │ ✅ Ready  │ │ │
│  │  ├────────────────────────────────────────────────────┤ │ │
│  │  │ ☑️ │ 🖼️ │ SH012 │ 156 fr │ 1920x1080 │ ⚠️ Gaps!  │ │ │
│  │  ├────────────────────────────────────────────────────┤ │ │
│  │  │ ☐ │     │ misc  │   -    │     -     │ ❌ Invalid│ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │                                                          │ │
│  │  Selected: 87 sequences                                  │ │
│  │  Est. Time: 2h 15m  •  Size: 245 GB                     │ │
│  │                                                          │ │
│  │                         [🚀 Process Selected (87)]       │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘

Design Notes:
- Browse button opens native folder picker
- Results table shows thumbnails (tiny, 100x56)
- Status icons: ✅ green (ready), ⚠️ yellow (warning), ❌ red (error)
- Hovering on warning shows details: "Missing frames: 45-50"
- Checkboxes allow selective processing
- Large "Process Selected" button shows count
```

---

### 5.4 Tab 3: Queue

```
┌────────────────────────────────────────────────────────────────┐
│ 🎬 CTrack Publish              👤 Sarah K.  [⚙️ Settings] [×] │
├────────────────────────────────────────────────────────────────┤
│  [📄 Quick Publish]  [📦 Bulk Ingest]  [📊 Queue]             │
│                                          ▔▔▔▔▔▔               │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  QUEUE STATUS                                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Active: 3  •  Pending: 12  •  Complete: 45  •  Failed: 2│ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ACTIVE JOBS                                                   │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │  SH010_comp_v003                                         │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │ Status: Uploading to S3                            │ │ │
│  │  │ [████████████████░░░░░░░░] 65%                     │ │ │
│  │  │                                                    │ │ │
│  │  │ Speed: 45 Mbps  •  ETA: 2m 15s  •  Size: 2.4 GB   │ │ │
│  │  │                                                    │ │ │
│  │  │              [⏸️ Pause]  [❌ Cancel]               │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │                                                          │ │
│  │  SH011_comp_v001                                         │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │ Status: Transcoding to MP4                         │ │ │
│  │  │ [██████████░░░░░░░░░░░░░░] 35%                     │ │ │
│  │  │                                                    │ │ │
│  │  │ Frame: 840/2400  •  Speed: 85 fps                 │ │ │
│  │  │                                                    │ │ │
│  │  │                         [❌ Cancel]                │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  PENDING (12)                                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  SH012, SH013, SH014, SH015, SH016...      [Expand All]  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  FAILED (2)                                                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ⚠️ SH020_v002                                           │ │
│  │     Error: Network timeout after 3 retries               │ │
│  │     [🔄 Retry]  [📋 View Log]                            │ │
│  │                                                          │ │
│  │  ❌ SH025_v001                                           │ │
│  │     Error: Missing frames (1105-1108)                    │ │
│  │     [📋 View Details]  [🗑️ Remove]                      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│               [Clear Completed]  [Export Logs]                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘

Design Notes:
- Real-time progress bars with smooth animation
- Color coding: Blue (processing), Green (complete), Red (failed)
- Expandable sections (Pending jobs collapsed by default)
- Clear actions for failed jobs (retry, view logs, remove)
- Speed/ETA shown for uploads
- Frame count/fps shown for transcoding
```

---

### 5.5 Settings Modal

```
┌────────────────────────────────────────────────────────────────┐
│  ⚙️ SETTINGS                                              [×]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  [General] [Media Processing] [Notifications] [Advanced]      │
│   ▔▔▔▔▔▔▔                                                     │
│                                                                │
│  GENERAL SETTINGS                                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │  Auto-Detection Confidence:                              │ │
│  │  ┌─────────────────────────────────┐                    │ │
│  │  │ High (95%+)  ▼                  │                    │ │
│  │  └─────────────────────────────────┘                    │ │
│  │  If detection confidence is below threshold, prompt      │ │
│  │  user for manual selection.                              │ │
│  │                                                          │ │
│  │  ☑️ Remember last project/shot selection                │ │
│  │  ☑️ Auto-launch on system startup                       │ │
│  │  ☐ Show file path in submissions                        │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  [Save]  [Cancel]                                              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Media Processing Tab**:

```
┌────────────────────────────────────────────────────────────────┐
│  ⚙️ SETTINGS                                              [×]  │
├────────────────────────────────────────────────────────────────┤
│  [General] [Media Processing] [Notifications] [Advanced]      │
│             ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                                 │
│                                                                │
│  PROXY GENERATION                                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │  Output Resolution:                                      │ │
│  │  ┌─────────────────────────────────┐                    │ │
│  │  │ 1920x1080 (Full HD)  ▼          │                    │ │
│  │  └─────────────────────────────────┘                    │ │
│  │  Options: 1920x1080, 1280x720, 960x540                  │ │
│  │                                                          │ │
│  │  Encoding Quality:                                       │ │
│  │  ┌─────────────────────────────────┐                    │ │
│  │  │ High (5 Mbps)  ▼                │                    │ │
│  │  └─────────────────────────────────┘                    │ │
│  │  Options: Low (2 Mbps), Medium (3.5 Mbps), High (5 Mbps)│ │
│  │                                                          │ │
│  │  Color Transform:                                        │ │
│  │  ┌─────────────────────────────────┐                    │ │
│  │  │ Linear → Rec.709  ▼             │                    │ │
│  │  └─────────────────────────────────┘                    │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  BURNINS                                                       │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │  ☑️ Add burnins to proxy videos                         │ │
│  │                                                          │ │
│  │  Top Left:    [Shot_Task_Version ▼]                     │ │
│  │  Top Right:   [Artist Name ▼]                           │ │
│  │  Bottom Left: [Timecode ▼]                              │ │
│  │  Bottom Right:[Frame Number ▼]                          │ │
│  │                                                          │ │
│  │  Font Size: [12 ▼]  Color: [White ▼]                   │ │
│  │  Background: [☑️ Semi-transparent black]                │ │
│  │                                                          │ │
│  │  [Preview Burnin]                                        │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  THUMBNAIL & GIF                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │  Thumbnail Frame:   [Middle (50%) ▼]                    │ │
│  │  GIF Frame Count:   [10 frames ▼]                       │ │
│  │  GIF Frame Rate:    [2 fps ▼]                           │ │
│  │  GIF Resolution:    [640x360 ▼]                         │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  [Save]  [Reset to Defaults]                                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Notifications Tab**:

```
┌────────────────────────────────────────────────────────────────┐
│  ⚙️ SETTINGS                                              [×]  │
├────────────────────────────────────────────────────────────────┤
│  [General] [Media Processing] [Notifications] [Advanced]      │
│                                 ▔▔▔▔▔▔▔▔▔▔▔▔▔                │
│                                                                │
│  DEFAULT NOTIFICATION RECIPIENTS                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │  For single publishes:                                   │ │
│  │  ☑️ Shot Supervisor (auto-detected)                     │ │
│  │  ☑️ Department Lead                                      │ │
│  │  ☐ Producer                                             │ │
│  │  ☐ Client                                               │ │
│  │                                                          │ │
│  │  For bulk ingests:                                       │ │
│  │  ☑️ Send summary email on completion                    │ │
│  │  ☐ Send email per sequence                             │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  NOTIFICATION PREFERENCES                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │  ☑️ Desktop notifications (system tray)                 │ │
│  │  ☑️ Sound on completion                                 │ │
│  │  ☑️ Notify me when my submission is reviewed            │ │
│  │  ☐ Daily summary email                                  │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  [Save]                                                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Advanced Tab**:

```
┌────────────────────────────────────────────────────────────────┐
│  ⚙️ SETTINGS                                              [×]  │
├────────────────────────────────────────────────────────────────┤
│  [General] [Media Processing] [Notifications] [Advanced]      │
│                                                 ▔▔▔▔▔▔▔▔       │
│                                                                │
│  PERFORMANCE                                                   │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │  Concurrent Jobs:                                        │ │
│  │  ┌──────┐                                               │ │
│  │  │  3   │ (1-5)                                         │ │
│  │  └──────┘                                               │ │
│  │  How many sequences to process simultaneously            │ │
│  │                                                          │ │
│  │  Upload Bandwidth Limit:                                 │ │
│  │  ┌─────────────────────────────────┐                    │ │
│  │  │ Unlimited  ▼                    │                    │ │
│  │  └─────────────────────────────────┘                    │ │
│  │  Throttle uploads if network is limited                  │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  STORAGE                                                       │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │  Temporary Files Location:                               │ │
│  │  ┌────────────────────────────────┐  [Browse...]        │ │
│  │  │ C:\Users\Sarah\AppData\Temp    │                    │ │
│  │  └────────────────────────────────┘                    │ │
│  │                                                          │ │
│  │  ☑️ Auto-delete temp files after upload                │ │
│  │  ☑️ Keep local copy of proxies (for 7 days)            │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  PATTERN LIBRARY (for auto-detection)                         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │  Active Patterns: 15 presets loaded                      │ │
│  │                                                          │ │
│  │  [Import Pattern File]  [Export Patterns]                │ │
│  │  [Edit Custom Patterns...]                               │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  DEBUG                                                         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │  ☐ Enable verbose logging                              │ │
│  │  ☐ Keep detailed processing logs                        │ │
│  │                                                          │ │
│  │  [View Logs Folder]  [Clear Cache]                      │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  [Save]  [Reset All to Defaults]                              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 6. Settings & Configuration

### 6.1 Enhanced Settings Categories

**1. GENERAL SETTINGS**

**Auto-Detection Behavior**:
- Confidence threshold slider (70%-100%)
- Fallback behavior: Ask user / Skip file / Best guess
- Pattern priority order (which patterns to try first)

**UI Preferences**:
- Dark mode / Light mode / System
- Compact view / Comfortable view
- Remember window size/position
- Show/hide thumbnail previews in tables

**Session Management**:
- Remember last project
- Remember last shot
- Auto-fill artist notes from template
- Keep login session for: 1 day / 7 days / 30 days

---

**2. MEDIA PROCESSING SETTINGS**

**Proxy Video**:
- Resolution: 1920x1080 / 1280x720 / 960x540 / Custom
- Codec: H.264 / H.265 / ProRes (if needed)
- Quality/Bitrate: Low (2 Mbps) / Medium (3.5 Mbps) / High (5 Mbps) / Custom
- Frame rate: Match source / Force 24fps / Force 30fps
- Color transform: Linear→Rec.709 / ACEScg→Rec.709 / Custom LUT

**Burnin Configuration**:
- Enable/disable burnins
- Position presets: 4-corner layout / Top bar only / Bottom bar only / Custom
- Text templates:
  - Top Left: `{project}_{shot}_{task}_v{version}` (customizable)
  - Top Right: `{artist}` or `{date}` or `{artist} | {date}`
  - Bottom Left: `{timecode}` or `{date} {time}`
  - Bottom Right: `Frame {frame}/{total}` or `{frame}` or `Global {global_frame}`
- Font: Size (10-20px), Color (white/yellow/cyan), Style (bold/normal)
- Background: None / Semi-transparent / Solid

**Thumbnail**:
- Source frame: First / Middle (50%) / Last / Custom frame number / Hero frame (if tagged)
- Size: 800x450 / 1280x720 / Custom
- Format: JPEG / PNG
- Quality: 60% / 80% / 90% / 100%

**Animated GIF**:
- Frame count: 5 / 10 / 15 / 20 frames
- Frame rate: 1 fps / 2 fps / 5 fps
- Resolution: 320x180 / 640x360 / 960x540
- Duration: Auto (based on frame rate) / Fixed 5 seconds / Fixed 10 seconds
- Loop: Infinite / Once / Custom count

---

**3. NOTIFICATION SETTINGS**

**Default Recipients** (per publish type):

Quick Publish:
- ☑️ Shot Supervisor (always)
- ☑️ Department Lead
- ☐ Producer
- ☐ Client
- ☐ Additional emails: [comma-separated list]

Bulk Ingest:
- ☑️ Send completion summary to supervisor
- ☐ Send per-sequence notifications
- ☐ Send daily batch summary

**Notification Channels**:
- ☑️ Email (via C-Track backend)
- ☑️ In-app notifications (C-Track Web)
- ☐ Slack (if integrated)
- ☐ Microsoft Teams (if integrated)
- ☑️ Desktop notifications (system tray)

**Personal Preferences**:
- ☑️ Notify me when my submission is reviewed
- ☑️ Notify me when my submission is approved
- ☐ Notify me when someone comments on my version
- ☑️ Play sound on notification
- ☐ Send me daily activity summary

---

**4. ADVANCED SETTINGS**

**Performance**:
- Concurrent jobs: 1-5 (slider)
- Max CPU usage: 50% / 75% / 100%
- Upload bandwidth limit: Unlimited / 10 Mbps / 25 Mbps / 50 Mbps / Custom
- Processing priority: Low / Normal / High

**Storage**:
- Temporary files location: [folder picker]
- ☑️ Auto-delete temp files after successful upload
- ☑️ Keep local copies of proxies for 7 days
- ☐ Keep local copies of original EXR (not recommended)
- Cache size limit: 10 GB / 50 GB / 100 GB / Unlimited

**Pattern Library**:
- Preset patterns: 15 included
- Custom patterns: [Edit...]
- Pattern priority: [Drag to reorder]
- Import/Export: [JSON file]

**Upload Behavior**:
- Retry failed uploads: 1 / 3 / 5 / Infinite times
- Retry delay: Exponential backoff / Fixed 30s / Fixed 60s
- ☑️ Pause uploads during peak hours (9 AM - 5 PM)
- ☑️ Resume incomplete uploads on restart

**Debug**:
- ☐ Enable verbose logging (performance impact)
- ☐ Keep detailed processing logs (disk space)
- ☐ Save failed frame images for debugging
- Log level: Error only / Warning / Info / Debug
- [Open Logs Folder] [Clear Cache] [Export Debug Info]

---

**5. PROJECT-SPECIFIC OVERRIDES**

Some settings can be overridden per project:

```
┌────────────────────────────────────────────────────────┐
│  PROJECT OVERRIDES - Hero Film                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Use project-specific settings:  [☑️]                 │
│                                                        │
│  Proxy Resolution:     [1920x1080 (override global)]  │
│  Color Transform:      [ACEScg → Rec.709]             │
│  Custom LUT:           [herofilm_review.cube]  [...]  │
│  Burnin Template:      [Hero Film Custom]             │
│  Default Supervisor:   [lisa@studio.com]              │
│  Client Notifications: [☑️ Always include client]     │
│                                                        │
│  [Save]  [Reset to Global]                            │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 7. Technical Architecture

### 7.1 Simplified Stack

```
┌─────────────────────────────────────────────┐
│         Electron + Next.js Shell            │
│  (Single window, 3 tabs, settings modal)    │
├─────────────────────────────────────────────┤
│         Python Processing Engine            │
│  (FFmpeg, OpenImageIO, thumbnails, GIFs)    │
├─────────────────────────────────────────────┤
│              Local Queue                    │
│         (SQLite database)                   │
├─────────────────────────────────────────────┤
│          Cloud Services                     │
│  • C-Track API (auth, metadata)             │
│  • AWS S3 (media storage)                   │
└─────────────────────────────────────────────┘
```

### 7.2 Data Flow

```
FILE DROP
   ↓
DETECTION (path parsing + file analysis)
   ↓
CONFIRMATION (show user detected context)
   ↓
QUEUE (add job to SQLite)
   ↓
PROCESSING (thumbnail → GIF → MP4)
   ↓
UPLOAD (S3 in parallel)
   ↓
DATABASE UPDATE (C-Track API)
   ↓
NOTIFICATION (email/in-app)
   ↓
COMPLETE ✅
```

### 7.3 Key Components

**Electron Main Process**:
- Handle file drop events
- Spawn Python worker processes
- Manage upload queue
- Communicate with C-Track API
- Store settings in local config

**Next.js Renderer**:
- Display UI tabs
- Show real-time progress
- Handle user input
- Settings modal

**Python Engine**:
- Scan sequences
- Generate thumbnails
- Generate GIFs
- Transcode to MP4
- Apply burnins
- Extract metadata

**Local Queue (SQLite)**:
- Persist pending jobs
- Track progress
- Handle retries
- Store logs

---

## 8. Development Phases

### Phase 1: Foundation (Week 1)
- Electron + Next.js setup
- Google OAuth integration
- 3-tab layout
- Basic file drop handling

### Phase 2: Quick Publish (Weeks 2-3)
- Path parsing / detection
- Python engine: thumbnail + GIF + MP4
- S3 upload
- C-Track API integration
- Notifications

### Phase 3: Bulk Ingest (Week 4)
- Folder scanning
- Parallel processing
- Queue management
- Batch notifications

### Phase 4: Settings & Polish (Week 5)
- Settings modal (all 4 tabs)
- Per-project overrides
- Error handling
- User documentation

### Phase 5: Testing & Launch (Week 6)
- Beta testing with 10 artists
- Bug fixes
- Performance optimization
- Production deploy

**Total: 6 weeks**

---

## Simplified Success Metrics

**Week 1**: App launches, OAuth works, tabs load
**Week 3**: Can publish single EXR sequence end-to-end
**Week 4**: Can bulk ingest 50 sequences
**Week 5**: Settings fully functional
**Week 6**: Beta feedback positive, ready for production

**3 Months Post-Launch**:
- 90% of artists using the tool
- Average publish time: <1 minute
- Bulk ingest: 100 plates in <2 hours
- 95%+ auto-detection accuracy
- <5% support tickets

---

**This streamlined PRD focuses on core features that deliver maximum value with minimum complexity. Every feature serves a clear user need and the workflow is optimized for speed and simplicity.**
