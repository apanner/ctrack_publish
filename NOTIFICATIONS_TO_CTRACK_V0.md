# Notifications from ctrack_publish → ctrack_v0

## Overview

When you publish shot versions or elements from **ctrack_publish**, notifications are sent to recipients who see them in **ctrack_v0** (Inbox, notification badge, Realtime updates).

## Flow

```
ctrack_publish                    Supabase DB                    ctrack_v0
     │                                  │                              │
     │  Publish (version/element)       │                              │
     │ ──────────────────────────────► │  shot_versions / shot_elements
     │                                  │                              │
     │  notifyShotPublishRecipients     │                              │
     │  rpc_notify_recipients           │                              │
     │ ──────────────────────────────► │  notifications (INSERT)      │
     │                                  │ ────────────────────────────►  Realtime
     │                                  │                              │  useNotifications
     │                                  │                              │  Inbox updates
```

## Recipients

Notifications go to:
- **Shot artist** (`shots.artist_id`)
- **Project members** with roles: supervisor, manager, production, admin
- **Task assignees** on that shot
- **Explicit recipients** from Quick Publish "Notify" checkboxes

Users who have disabled `my_version_created` or `my_element_published` in Settings → Notifications are excluded.

## Requirements

1. **Same Supabase** — ctrack_publish and ctrack_v0 must use the same Supabase project (`VITE_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`).

2. **Realtime enabled** — Supabase Dashboard → Database → Replication → enable for `notifications` table.

3. **Migrations applied** — Run migration `070_add_element_published_notifications.sql` so `element_published` and `my_element_published` are in the type checks.

4. **Actor must be authenticated** — ctrack_publish user must be logged in; `rpc_notify_recipients` validates `auth.uid() = p_actor_id`.

## Trigger locations (ctrack_publish)

| Event              | Hook                     | Type                | Granular preference   |
|--------------------|--------------------------|---------------------|------------------------|
| Version published  | `usePublishQueue.ts`     | `version_submitted` | `my_version_created`   |
| Element published  | `usePublishQueue.ts`     | `element_published` | `my_element_published` |

Both Quick Publish and Bulk Ingest use the same publish path.

## ctrack_v0 display

- **Inbox** (`/inbox`), **Inbox sidebar** — lists notifications, maps `version_submitted` / `element_published` to "review" tab
- **Notification link** — opens project/shot with `?tab=versions` when `version_id` is set
- **Sound** — plays on new notification if enabled in Settings
- **Realtime** — `useNotifications` subscribes to `notifications` filtered by `user_id`

## Verification (ensure it works)

1. **Run migrations**  
   `cd ctrack_v0 && npx supabase db push` (or apply 058, 067, 070 manually)

2. **Same Supabase**  
   ctrack_publish `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`  
   ctrack_v0 `.env`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
   Values must match.

3. **Test flow**  
   - Log into ctrack_publish as User A  
   - Log into ctrack_v0 as User B (recipient: shot artist, PM, or task assignee)  
   - Publish a version or element from ctrack_publish  
   - Check ctrack_v0 Inbox; notification should appear (Realtime) or after refresh

4. **If notify fails**  
   - ctrack_publish: Queue job log shows `Notification failed: [code] message`  
   - Console: `[NOTIFY] rpc_notify_recipients failed` or `Skipped: no valid session`  
   - Common causes: session expired, migration 070 not applied, different Supabase project
