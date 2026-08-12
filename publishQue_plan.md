# CTrack Publish — Smart Batch Chunk Processing Plan

## 1. Concept Overview

**Problem:** Current publishing processes EXR/video sequences in a single FFmpeg run. One job = one FFmpeg process = limited parallelism. CPU cores are underutilized for long sequences.

**Solution:** Render-farm style **split → process → combine** — but **only for image sequences** (EXR, JPG, PNG, TGA, TIFF). Video files (MOV, MP4, AVI, MKV) use direct single-pass transcode.

**Processing order (all input types):**
1. **MP4 first** — Transcode input → MP4.
2. **Then WebP + Thumbnails** — Generate from the MP4 (not from original). Faster: one decode from MP4 instead of heavy EXR/sequence decode twice.

---

## 2. Input-Based Process Selection (Smart / Adopted)

| Input Type | Detection | Process | Chunking |
|------------|-----------|---------|----------|
| **Image sequence** (EXR, JPG, PNG, TGA, TIFF) | `%04d` pattern + frame_start/end | Transcode → MP4 → WebP + thumbs from MP4 | Yes if frames ≥ 50 |
| **Video file** (MOV, MP4, AVI, MKV, etc.) | Extension + no frame range | Transcode → MP4 → WebP + thumbs from MP4 | **No** — direct single pass |
| **Single static image** | One file, no sequence | Thumb from image; no MP4 or WebP (or 1-frame MP4) | No |

**Rule:** Split/join **only** for image sequences. Video files are streamed; no frame-based splitting.

---

## 3. Concat: Does It Work Reliably?

**Yes.** FFmpeg concat demuxer (`-f concat -i filelist.txt -c copy`) is standard and reliable when:

- All chunks use **identical codec, resolution, framerate, pixel format**.
- Chunks are listed in correct order.
- No re-encoding — `-c copy` just concatenates bitstreams (very fast, no quality loss).

**Requirements for our chunked transcode:**
- Every chunk uses same: libx265/libx264, CRF, preset, resolution, pixel_format.
- Build chunks with the same options dict.
- Concat step is copy-only (`-c copy`) → no re-encode, no quality loss, seamless playback.

**Conclusion:** Combining chunks works reliably when chunk encoding is consistent. FFmpeg concat is widely used in production pipelines.

---

## 4. Processing Order (Revised)

```
[Input]
    │
    ├─ IMAGE SEQUENCE (EXR/JPG/PNG/…) ──► Chunk if ≥50 frames ──► MP4 (chunked or single)
    │                                                                    │
    └─ VIDEO FILE (MOV/MP4/AVI/…)     ──► Single-pass transcode   ──► MP4  │
                                                                         │
                                                                         ▼
                                                              [MP4 ready]
                                                                         │
                                                    ┌────────────────────┴────────────────────┐
                                                    ▼                                         ▼
                                            WebP preview                              Thumbnails
                                         (from MP4, single pass)                    (from MP4)
```

**Why MP4 first, then WebP + thumbs from MP4:**
- One heavy decode: EXR sequence → MP4.
- WebP and thumbnails decode from MP4 (much lighter than EXR).
- Avoids reading EXR sequence twice; simpler pipeline.

---

## 5. When to Use Chunked Processing

| Scenario | Chunked? | Reason |
|----------|----------|--------|
| Image sequence (EXR/JPG/PNG/TGA/TIFF), 1–49 frames | No | Overhead > benefit |
| Image sequence, 50+ frames | Yes (2–8 chunks) | Good CPU utilization |
| Video file (MOV, MP4, AVI, MKV) | **No** | No frame-based split; single pass |
| Single static image | No | No transcode or trivial |

---

## 6. Chunk Strategy (Image Sequences Only)

### 6.1 Chunk Count

```
chunk_count = min(
  max(1, total_frames // chunk_size),
  max_chunks  // e.g. 8
)
```

- `chunk_size` = target frames per chunk (e.g. 25, 50).
- `max_chunks` = cap to avoid too many temp files (e.g. 8).
- `chunk_count` can also be tied to `os.cpu_count()` (e.g. `min(8, cpu_count - 1)`).

### 6.2 Example: Frames 1001–1100 (100 frames)

| Chunk | Frames | Temp Output |
|-------|--------|-------------|
| 1 | 1001–1025 | `out_chunk_0.mp4` |
| 2 | 1026–1050 | `out_chunk_1.mp4` |
| 3 | 1051–1075 | `out_chunk_2.mp4` |
| 4 | 1076–1100 | `out_chunk_3.mp4` |

Each FFmpeg:

```
ffmpeg -start_number 1001 -framerate 24 -i seq.%04d.exr -frames:v 25 -c:v libx265 ... out_chunk_0.mp4
ffmpeg -start_number 1026 -framerate 24 -i seq.%04d.exr -frames:v 25 -c:v libx265 ... out_chunk_1.mp4
...
```

Concat:

```
ffmpeg -f concat -safe 0 -i filelist.txt -c copy final.mp4
```

`filelist.txt`:

```
file 'out_chunk_0.mp4'
file 'out_chunk_1.mp4'
file 'out_chunk_2.mp4'
file 'out_chunk_3.mp4'
```

---

## 7. Burn-In and Metadata

Burn-in (shot, version, frame number) must be correct per chunk:

- **Shot/Version/Artist/Date** — Same for all chunks.
- **Frame number** — Use `start_number` per chunk so drawtext `%{frame_num}` shows the correct frame for each chunk.

Example for chunk 2 (1026–1050):

```python
start_num = 1026
# drawtext uses start_number for frame_num
filters.append(f"drawtext=...:start_number={start_num}:...")
```

---

## 8. Implementation Plan

### Phase 1: Python — Input Detection & Routing

**File:** `python/modules/transcode.py`

```python
def is_image_sequence(input_path, options):
    """True if input is EXR/JPG/PNG/TGA sequence (not video file)."""
    if not input_path: return False
    ext = input_path.lower().split('.')[-1].split('%')[0]
    image_exts = {'exr', 'jpg', 'jpeg', 'png', 'tga', 'tif', 'tiff'}
    has_pattern = '%' in input_path or '#' in input_path
    has_range = options.get('frame_start') is not None and options.get('frame_end') is not None
    return (ext in image_exts or any(input_path.lower().endswith(e) for e in ['.exr','.jpg','.png'])) and (has_pattern or has_range)

def transcode_to_mp4(input_path, output_path, options, log_callback=None):
    """
    Smart router: image sequence → chunked or single; video file → single pass.
    Returns MP4 path.
    """
    if is_image_sequence(input_path, options):
        total = (options.get('frame_end', 0) - options.get('frame_start', 1) + 1)
        if total >= 50:
            return transcode_sequence_chunked(input_path, output_path, options, log_callback)
    return transcode_sequence(input_path, output_path, options, log_callback)

def transcode_sequence_chunked(input_path, output_path, options, log_callback=None):
    """
    Image sequences only. Splits into chunks, transcodes in parallel, concats.
    """
    chunk_size = options.get('chunk_size', 25)
    max_chunks = options.get('max_chunks', min(8, (os.cpu_count() or 4) - 1))
    chunks = build_frame_chunks(options['frame_start'], options['frame_end'], chunk_size, max_chunks)
    temp_dir = tempfile.mkdtemp()
    temp_paths = []

    try:
        with ProcessPoolExecutor(max_workers=len(chunks)) as ex:
            futures = []
            for i, (start, end) in enumerate(chunks):
                chunk_opts = {**options, 'start_frame': start, 'frame_count': end - start + 1}
                chunk_out = os.path.join(temp_dir, f'chunk_{i}.mp4')
                temp_paths.append(chunk_out)
                futures.append(ex.submit(transcode_chunk, input_path, chunk_out, chunk_opts, log_callback))

            for f in futures:
                f.result()  # raise on error

        concat_chunks(temp_paths, output_path, log_callback)
        return {'status': 'success', 'output': output_path}
    finally:
        for p in temp_paths:
            try: os.remove(p)
        os.rmdir(temp_dir)
```

**New helpers:**
- `build_frame_chunks(start, end, chunk_size, max_chunks)` → `[(1001,1025), (1026,1050), ...]`
- `transcode_chunk(input, output, options)` — transcodes one range (subset of `transcode_sequence` logic).
- `concat_chunks(paths, output, log_callback)` — builds filelist, runs `ffmpeg -f concat -i ... -c copy`.

---

### Phase 2: Process Order — MP4 First, Then WebP + Thumbnails from MP4

**Flow:**
1. `transcode_to_mp4(input) → mp4_path`
2. `generate_preview_webp(mp4_path, webp_path)` — input is MP4
3. `generate_thumbnails(mp4_path, thumb_dir)` — input is MP4 (or first frame)

**Changes:**
- `thumbnails_and_transcode_parallel` → **remove**; replace with sequential: transcode first, then thumbnails + webp from MP4.
- `transcode_and_webp_parallel` → **remove**; new flow: transcode → webp from MP4.

---

### Phase 3: Engine Commands

**File:** `python/engine.py`

- `transcode` → routes to `transcode_to_mp4` (which picks chunked vs single based on input).
- New command `transcode_then_webp_thumb` (or extend existing): MP4 first, then webp + thumb from MP4.

---

### Phase 4: Electron / usePublishQueue Integration

- Pass `frame_start`, `frame_end`, and optionally `chunk_size` / `max_chunks` in transcode params.
- `usePublishQueue` already has `meta.frameStart` / `meta.frameEnd` from staging.
- No structural changes needed if the Python API stays the same; only richer options.

---

### Phase 5: Progress Reporting

Each chunk reports FFmpeg progress (e.g. frame N of M). Aggregate:

```
overall_progress = (sum of completed chunks + current_chunk_progress) / total_chunks * 100
```

Requires either:
- Progress callbacks from subprocess (parse stderr per chunk), or
- Simpler: report per-chunk completion (chunk 1/4 done, 2/4 done, …).

---

## 9. Settings / Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `chunked_transcode.enabled` | `true` | Turn chunked transcode on/off |
| `chunked_transcode.min_frames` | `50` | Only chunk if sequence ≥ this |
| `chunked_transcode.chunk_size` | `25` | Target frames per chunk |
| `chunked_transcode.max_chunks` | `8` | Max parallel chunks |

---

## 10. Edge Cases

| Case | Handling |
|------|----------|
| Chunk fails | Fail whole job; clean up temp files |
| Odd frame count | Last chunk has fewer frames |
| Single-frame sequence | Skip chunking |
| Video input (MOV/MP4/etc.) | Single-pass `transcode_sequence`; no chunking |
| Concat codec mismatch | Ensure all chunks use identical codec/params |
| Burn-in on boundaries | `start_number` per chunk keeps frame numbers correct |

---

## 11. Thumbnails and WebP (From MP4)

- **Source** — Both WebP and thumbnails are generated **from the MP4**, not from the original EXR/sequence/video.
- **Thumbnails** — Extract frame(s) from MP4; no chunking.
- **WebP** — Single FFmpeg pass over MP4; no chunking.
- **Benefit** — One heavy decode (EXR→MP4); WebP/thumb decode from MP4 is fast.

---

## 12. Summary

| Component | Change |
|-----------|--------|
| **transcode.py** | Add `is_image_sequence`, `transcode_to_mp4`, `transcode_sequence_chunked`, `transcode_chunk`, `concat_chunks`, `build_frame_chunks` |
| **engine.py** | New flow: MP4 first → WebP + thumb from MP4; route transcode by input type |
| **thumbnail.py** | Accept MP4 as input (in addition to sequence) for post-transcode thumbs |
| **usePublishQueue** | Ensure `frame_start`/`frame_end` passed for sequences; no change for video files |
| **Settings** | Optional UI for chunk size / max chunks |
| **Process order** | MP4 → WebP + Thumbnails (both from MP4) |

**Expected outcome:**
- Image sequences: chunked transcode when ≥50 frames; WebP + thumbs from MP4.
- Video files: single-pass transcode; WebP + thumbs from MP4; no split/join.
- Concat: reliable with identical chunk params; `-c copy` = no quality loss.
