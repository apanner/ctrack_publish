# Project Creation Wizard Plan — ctrack_publish

## 1. Current ctrack_publish Understanding

### 1.1 Existing Connections & Env

| Env | Purpose |
|-----|---------|
| `VITE_SUPABASE_URL` | Supabase instance (shared with ctrack_v0) |
| `VITE_SUPABASE_ANON_KEY` | Anon client — reads projects, shots, episodes; writes shot_versions, shot_elements |
| `VITE_AUTH_CALLBACK_URL` | OAuth redirect for login |
| `AWS_*`, `HYBRID_*`, `STORAGE_PROVIDER` | S3 / hybrid storage (Electron main process) |

**No HTTP API to ctrack_v0.** All DB access is via Supabase client from the renderer.

### 1.2 What ctrack_publish Already Does

| Feature | How |
|---------|-----|
| Projects, shots, episodes | `useProjects()`, `useShots()`, `useEpisodes()` — read via `supabase.from()` |
| Publish versions | `usePublishQueue` → inserts `shot_versions` via supabase |
| Publish elements | `usePublishQueue` → inserts `shot_elements` via supabase |
| Scan folder | `ipcRenderer.invoke("python-command", { command: "scan_folder", params: { folder_path } })` |
| Pick folder | `ipcRenderer.invoke("select-directory")` |
| S3 upload | `ipcRenderer.invoke("upload-s3", { filePath, bucketName, key })` |
| Queue | `queue:add-job`, `queue:update-job`, etc. |

### 1.3 RLS & Project Creation

ctrack_v0 migrations: `"Admins and managers can manage projects"` on `projects` — FOR ALL when `is_admin_or_manager(auth.uid())`.

- Logged-in user with `profile.role IN ('admin','manager')` can **INSERT** projects via the anon Supabase client.
- Same pattern for sequences, shots, shot_tasks (admin/manager policies exist).
- **No new API or RPC needed** — use existing `supabase` client.

---

## 2. Plan: Use Existing Infrastructure

### 2.1 Principle

- **No new HTTP routes** — do not call ctrack_v0 API.
- **No new env** — reuse `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Supabase direct** — `supabase.from('projects').insert()`, `.from('sequences').insert()`, etc.
- **Reuse IPC** — `select-directory`, `python-command` (scan_folder), `queue:add-job` via usePublishQueue.

### 2.2 Creation Logic (Port from ctrack_v0)

Port the create-wizard logic into a ctrack_publish service that uses `supabase` (anon client):

1. `supabase.from('projects').insert(...).select('id,folder_id')`
2. `supabase.from('episodes').insert(...)` (TV only)
3. `supabase.from('sequences').insert(...).select('id,code,folder_id')`
4. `supabase.from('shots').insert(...)` per shot
5. `supabase.from('shot_tasks').insert(...)` (batch)

**RLS**: User must be admin or manager. If RLS blocks, add a Supabase RPC `create_project_from_wizard` (SECURITY DEFINER) as a fallback — still no HTTP route.

### 2.3 Bulk Ingest Step

- Reuse BulkIngestView: `handleScan(path)` uses `python-command` + `scan_folder`.
- Reuse `addJob` from usePublishQueue.
- Map scan rows to new shots by `sequence_name` + `shot_code` (same as BulkIngestView `findBestShotMatch`).

---

## 3. Wizard Steps (Same as ctrack_v0)

| Step | Name | Content |
|------|------|---------|
| 0 | Project Type | Film vs TV Episode |
| 1 | Project Info | Name, code, description, dates, client, status |
| 2 | Episodes | TV only: episodes |
| 3 | Sequences | Sequences (per-episode for TV) |
| 4 | Shots | Paste Excel; column mapping; task codes; enable/disable |
| 5 | Review & Create | Summary; create via Supabase; progress |
| 6 | Bulk Ingest | Select folder → scan → map → queue element ingest |

---

## 4. Architecture (No New Routes)

```
┌─ ctrack_publish (existing) ─────────────────────────────────────┐
│  supabase (VITE_SUPABASE_*)                                      │
│    → projects.insert, sequences.insert, shots.insert,           │
│      shot_tasks.insert, episodes.insert                          │
│                                                                  │
│  ipcRenderer                                                     │
│    → select-directory (folder picker)                            │
│    → python-command scan_folder                                  │
│    → queue:add-job (via usePublishQueue)                         │
│                                                                  │
│  useProjects, useShots, useEpisodes (existing)                   │
│  usePublishQueue (existing) — addJob, processNextJob              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Phases

### Phase 1: Project Creation via Supabase

- [ ] Create `src/lib/project-wizard-service.ts` — port logic from ctrack_v0 `project-wizard-service.ts` + create-wizard route.
- [ ] Use `supabase` from `@/lib/supabase` (existing).
- [ ] Insert: projects → episodes (TV) → sequences → shots → shot_tasks.
- [ ] Match ctrack_v0 schema (sequence_name, shot_code, episode_id, project_type, etc.).
- [ ] Check RLS: if insert fails for admin user, add RPC fallback or verify policy.

### Phase 2: Wizard UI

- [ ] Create `ProjectCreationWizard` (modal or view).
- [ ] Steps 0–5: port/adapt UI from ctrack_v0 `project-creation-wizard.tsx`.
- [ ] Load task options from `studio_dictionaries` + `studio_dictionary_items` (same Supabase).
- [ ] On create: call `createProjectFromWizard(data)` from project-wizard-service.
- [ ] On success: set `projectId` in context (`setProjectId`), invalidate `useProjects` query, close wizard.

### Phase 3: Entry Points

- [ ] Sidebar: add "Create Project" nav item (or tab).
- [ ] ContextBar: "Create Project" when no project selected.
- [ ] Bulk Ingest: "No project? Create one" link.

### Phase 4: Bulk Ingest Step (Step 6)

- [ ] After create success: show Step 6 — "Ingest elements?"
- [ ] "Skip" → close wizard, keep project selected.
- [ ] "Select Folder" → `ipcRenderer.invoke("select-directory")` → `handleScan(path)` (extract from BulkIngestView or reuse).
- [ ] Map scan rows to new shots (`shots` from creation result; match by sequence_name, shot_code).
- [ ] For each matched row: `addJob(..., { tab: 'element', elementCategory: 'media', ... }, customContext)`.
- [ ] `processNextJob()`; navigate to Queue tab; close wizard.

### Phase 5: Polish

- [ ] Role check: show wizard only if `profile?.role === 'admin' || profile?.role === 'manager'` (or hide for others).
- [ ] Error handling: creation/scan failures, toasts.
- [ ] Optional: thumbnail upload (would need storage API or Supabase storage — defer).

---

## 6. Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/project-wizard-service.ts` | **Create** — Supabase inserts for project, episodes, sequences, shots, shot_tasks |
| `src/views/ProjectCreationWizardView.tsx` | **Create** — wizard UI (or modal) |
| `src/components/layout/Sidebar.tsx` | Add "Create Project" entry |
| `src/components/layout/ContextBar.tsx` | Add "Create Project" when empty |
| `src/views/BulkIngestView.tsx` | Add "No project? Create one" link; optionally export `handleScan` / `scanFolder` |
| `src/components/layout/AppShell.tsx` | Add tab/view for wizard |
| `src/hooks/use-ctrack-data.ts` | Add `useTaskOptions()` for studio_dictionary_items (or inline in wizard) |

---

## 7. project-wizard-service.ts Outline

```ts
// Uses supabase from @/lib/supabase
// Same WizardData shape as ctrack_v0
export async function createProjectFromWizard(data: WizardData): Promise<{ projectId: string; shots: Array<{ id: string; shot_code: string; sequence_name: string }> }> {
  const { data: projectData, error: projectError } = await supabase.from("projects").insert({...}).select("id, folder_id").single()
  if (projectError) throw projectError
  // episodes (TV), sequences, shots, shot_tasks — same order as ctrack_v0
  return { projectId, shots }
}
```

No service role; RLS applies. User must be admin/manager.

---

## 8. Bulk Ingest Step Flow

```
User clicks "Select Folder & Ingest"
  → ipcRenderer.invoke("select-directory") → path
  → ipcRenderer.invoke("python-command", { command: "scan_folder", params: { folder_path: path } })
  → response.data = RawScanItem[]
  → For each item: findBestShotMatch(item, newShots) — same logic as BulkIngestView
  → For each matched: addJob(inputPath, options, meta, { projectId, projectCode, shotId, shotCode, sequenceName, ... })
  → processNextJob()
  → setActiveTab('queue')
```

---

## 9. Summary

| Principle | Detail |
|-----------|--------|
| **No new routes** | Use existing Supabase client only |
| **No new env** | VITE_SUPABASE_* already configured |
| **Reuse IPC** | select-directory, python scan_folder, queue |
| **Reuse hooks** | useProjects, useShots, usePublishQueue |
| **Create logic** | Port to project-wizard-service.ts; direct supabase inserts |
| **RLS** | Admin/manager can INSERT projects; same for sequences, shots, tasks |
