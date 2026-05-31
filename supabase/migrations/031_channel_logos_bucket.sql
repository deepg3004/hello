-- 031_channel_logos_bucket
-- Public bucket for uploaded channel logos (reliable hosting; pasted Google
-- thumbnail URLs are hotlink-blocked). Applied to prod 2026-05-31.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('channel-logos', 'channel-logos', true, 2097152,
        array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = true;
