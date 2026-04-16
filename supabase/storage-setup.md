# Supabase Storage Setup

## Create the `vehicle-photos` bucket

1. Open your Supabase project → **Storage** → **New bucket**
2. Bucket name: `vehicle-photos`
3. Public bucket: **OFF** (private — images accessed via service role key only)
4. File size limit: 10 MB (recommended)
5. Allowed MIME types: `image/jpeg, image/png, image/webp, image/heic`
6. Click **Create bucket**

## Add a unique constraint on uploads (session_id, panel)

The upload API uses `upsert` with `onConflict: "session_id,panel"` so a client can
retake a photo without creating duplicate rows. Run this in the Supabase SQL editor:

```sql
alter table uploads
  add constraint uploads_session_panel_unique unique (session_id, panel);
```

## Row-Level Security

The API uses the service role key (bypasses RLS) so no RLS policies are needed for
server-side access. If you later add client-side Supabase access, add appropriate
policies at that time.
