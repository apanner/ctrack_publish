# What Happens After You Drop a File

1. **Drop or select a file**  
   The file is added to the **queue** (shown in the right panel as “Active Threads”). You can drop multiple files; each appears as one item.

2. **Choose context (top bar)**  
   Select **Project**, **Shot**, and optionally **Task**. Optionally set **Category** (Media / Document) and **Element type** (Plate / Edit ref / Other) for elements. Set **Ver** (e.g. v001) if needed.

3. **Click “Publish”**  
   For each queued item the app will:
   - **Transcode** the file to MP4 (via Python) for preview/delivery.
   - **Upload** the file (and transcoded MP4) to AWS S3.
   - **Create a version** in CTrack (Supabase `shot_versions`) for the selected Project and Shot, with `file_url` / `video_path` and `submitted_by` from your session.

4. **Result**  
   The version appears in the CTrack web app for that shot. Queue items move to “completed” or show an error if something failed.
