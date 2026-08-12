# CTrack Publish V2 - GUI Layout & Design System

## 1. Design Philosophy
**"Dark, Dense, Pro."**
The interface should feel like a native extension of high-end VFX software (Nuke, Houdini, DaVinci Resolve).
- **Colors**: Deep Greys (`#1A1A1A`, `#2A2A2A`). No pure blacks or bright whites.
- **Accents**: Muted primary color (e.g., `#3B82F6` blue) for actions. Red (`#EF4444`) only for errors.
- **Typography**: `Inter` or `Geist Sans`. Small, legible font sizes (12px-14px). Monospaced fonts for paths and code.
- **Density**: High information density. Avoid "lots of whitespace" which is common in consumer web apps but annoying in pro tools.

## 2. Window Layout (Electron Shell)
- **Frameless Window**: Custom Titlebar integrated into the UI.
- **Dimensions**: Default 1000x800. Resizable.
- **Title Bar**:
    - **Left**: "CTrack Publish" Logo + Current Project Name (Dropdown to switch).
    - **Right**: User Avatar, Minimize, Close.

## 3. Global Navigation (Sidebar - Left)
Width: 60px (Collapsed) or 200px (Expanded).
Icons from `Lucide React`.
1.  **Publish** (Icon: `UploadCloud`): The main Artist view (Single Shot).
2.  **Bulk Ingest** (Icon: `Layers`): The Data Wrangler view (Multi Shot).
3.  **Queue** (Icon: `ListVideo`): Active background jobs.
4.  **History** (Icon: `History`): Past publishes log.
5.  **Settings** (Icon: `Settings`): Paths, Python env, Debug.

## 4. View Design

### 4.1 "Publish" (Artist View)
**Layout**: Top Bar + Split View.

**Top Interaction Area: The Context Bar**
- A prominent horizontal bar running across the view.
- **[ Project Dropdown ]** > **[ Sequence Dropdown ]** > **[ Shot Dropdown ]**
- **Right Side**: **[ Version Input (e.g., v006) ]**
- *This is the source of truth. Dragging files updates these dropdowns, but user can click to change them anytime.*

**Main Content Area (Split)**

**Left Panel: The Staging Zone**
- **State A (Empty)**:
    - Large dashed border area.
    - Centered Text: "Drag Render Folder Here".
- **State B (File Loaded)**:
    - **Top**: Thumbnail Preview (Large).
    - **Middle**: "Health Strip" (Green/Red blocks for frames).
    - **Bottom**: Source Path: `D:/.../render.exr`

**Right Panel: Metadata & QC**
- **QC Status List**:
    - ✅ Resolution (1920x1080)
    - ✅ Frame Range (1001-1050)
- **Notes Field**: Large text area.
- **Publish Action**:
    - Big Blue Button: "PUBLISH to SH010".

### 4.2 "Bulk Ingest" (Wrangler View)
**Layout**: Top Bar + Data Grid.

**Top Bar**:
- Input: "Root Folder Path" [ Browse ].
- Button: "Scan Directory".
- Filters: "Show Errors Only", "Show New Shots".

**Main Area**: Data Grid (React Table).
- Columns: `Status` (Icon), `Path`, `Detected Shot`, `Frame Range`, `Action`.
- **Status Icons**:
    - 🟢 Ready (Matched existing shot).
    - 🟡 New (Will create new shot).
    - 🔴 Error (Missing frames / Bad naming).
- **Behavior**:
    - Multi-select rows.
    - Context Menu: "Ignore", "Force Version".
    - Bottom Bar: "Ingest 50 Shots" Button.

### 4.3 "Queue"
**Layout**: Stacked Cards.
- Each Card represents a job.
- **Left**: Thumbnail.
- **Center**: Job Title ("SH010_v005"), Steps progress (Transcoding... Uploading...).
- **Right**: Speed (MB/s), Cancel Button.

## 5. UI Components (Shadcn/UI Mapping)
- **Dialogs**: `Dialog`, `AlertDialog` for confirmations.
- **Forms**: `Input`, `Select`, `Textarea`, `Form` (react-hook-form).
- **Data**: `Table` (TanStack Table), `ScrollArea`.
- **Feedback**: `Sonner` (Toasts), `Progress` (Bars).
- **Visuals**: `Badge` (Status), `Card` (Containers), `Separator`.

## 6. Iconography
Use `Lucide-React`:
- `FileImage`, `FileVideo` for file types.
- `CheckCircle2`, `AlertTriangle`, `XCircle` for QC status.
- `Loader2` for processing.
