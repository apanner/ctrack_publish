# CTrack Publish V2 - Product Requirements Document (PRD)

## 1. Executive Summary
**CTrack Publish V2** is a professional desktop application for VFX Studios. It serves as the bridge between Artist Workstations (Local) and the CTrack Cloud Platform (Supabase/S3).
**Target Audience**: Data Wranglers, FX/Comp Artists, Coordinators.
**Core Value**: "One drag to publish." It automates the tedious technical checks (QC), transcoding (Proxies), and data entry (Database) required to submit a shot version.

## 2. Core Features

### 2.1 The "Always-On" Context Bar (Dropdowns)
**Primary Selection Interface**:
- A permanent bar at the top of the UI containing searchable dropdowns:
    1.  **Project Select**: Lists all active projects (e.g., "Avatars").
    2.  **Sequence Select** (dependent on Project): Lists sequences (e.g., "SEQ01").
    3.  **Shot Select** (dependent on Sequence): Lists shots (e.g., "SH010").
    4.  **Version Input**: defaults to next available (e.g., "v006"), but fully editable.
- **Behavior**:
    - Users can **manually select** any context to publish to.
    - **Smart-Fill**: When a user drags a file in, the app attempts to *match* and *select* the correct values in these dropdowns automatically. The user can then see and correct them if needed.

### 2.2 The Staging Zone
- **Drag & Drop**:
    - Large area below the Context Bar.
    - Accepts Folder (Sequence) or File (Movie).
    - If Context Bar is empty, dragging a file attempts to fill it.
    - Visual feedback on drag hover to confirm file validity.

### 2.2 Automated QC (Quality Control)
Before allowing a publish, the app runs a "Health Check":
- **Gap Detection**: Scans sequence for missing frames (e.g., 1001, 1002, [MISSING], 1004).
- **Resolution Check**: Compares EXR headers against Project Settings (e.g., warn if 1920x1080 when project is 4k).
- **Corrupt File Check**: "Black frame" or 0-byte file detection.
- **Visual Feedback**: A "Health Bar" for the sequence. Green = Good, Red Blocks = Missing.

### 2.3 The Local Media Engine (Python Sidecar)
A lightweight local Python process handles heavy lifting:
- **Thumbnail Gen**: Extracts the middle frame of a sequence to create a .jpg thumbnail.
- **Transcoding**: Converts linear EXR sequences to Review MP4s (h.264).
- **Burn-ins**: uses FFmpeg `drawtext` to bake in:
    - Shot Code
    - Frame Number
    - Date / Artist Name

### 2.5 Advanced Studio Features
- **Smart Slates & Burn-ins**:
    - Automatic text overlay on top/bottom of the MP4 proxy.
    - Fields: Project Name, Shot Code, Artist Name, Frame Count, Date.
    - Safety Area Overlay (2.39, 1.85, 16:9).
- **Review Player Integration**:
    - "Play Source" button launches local high-res EXRs in **RV**, **DJV**, or **Chaos Player**.
- **Chat Integration**:
    - "Notify Channel": Optional checkbox to post a message to Slack/Teams/Discord upon publish.

## 3. User Flows

### Flow A: The "Artist Daily" (Smart Path)
1. Artist works on `SH010_v005` in Nuke.
2. Drags render folder to CTrack Publish.
3. **App Magic**: Detects `Project: Avatars`, `Shot: SH010`. Queries Supabase to verify shot exists.
4. **Validation**: QC Engine runs (Checks frames, resolution).
5. **Review**: Artist sees "Ready to Publish" green light.
6. **Action**: Clicks "Publish". App minimizes, notifies when done.

### Flow B: The "Manual Override" (When naming is bad)
1. Artist has a messy folder `Desktop/final_render_v2`.
2. Drags folder. App says "Unknown Context".
3. Artist uses **Top Context Bar**:
    - Selects `Project: Avatars`.
    - Selects `Shot: SH010`.
4. App now links the files to `SH010` and proceeds to QC.

### Flow B: The "Data Wrangler" (Bulk Ingest)
1. Wrangler receives hard drive with 50 shots.
2. Drags `ROOT` folder to "Bulk Ingest" tab.
3. App scans recursively, finding 50 image sequences.
4. Presents a "Manifest Table":
    - 48 Shots: Ready to Ingest.
    - 2 Shots: Missing Frames (Highlighted Red).
5. Wrangler selects valid shots, clicks "Ingest".
6. App creates Shot entities in DB if missing, then uploads media.

## 4. Technical Non-Negotiables
- **Dark Mode Only**: Interface must match high-end VFX tools (Nuke, Resolve).
- **Background Robustness**: If the UI is closed, the upload/transcode worker must survive (or warn user).
- **Zero Config**: Should work out of the box by reading Project config from the Cloud.

## 5. Deployment
- **Installer**: `.exe` for Windows.
- **Size**: < 150MB initial download.
- **Updates**: Auto-update via GitHub Releases or S3 bucket.
