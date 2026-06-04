-- =============================================================================
-- 051 — private bucket for protected course video (Session 9, Course DRM)
--
-- New course-video uploads go to this PRIVATE bucket and are played only via
-- short-lived signed URLs minted by /api/courses/video-url (gated on a valid
-- course-access token or the owning seller). Existing public learn-media videos
-- keep working unchanged (legacy, unprotected). Thumbnails/images stay in the
-- public learn-media bucket.
-- =============================================================================

begin;

insert into storage.buckets (id, name, public)
values ('course-media', 'course-media', false)
on conflict (id) do nothing;

commit;
