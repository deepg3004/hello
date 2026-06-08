-- Lessons can be one of several content types, not just video. `asset_url`
-- holds the PDF/image source (video keeps using video_url; text uses content).
alter table course_lessons
  add column if not exists lesson_type text not null default 'video',
  add column if not exists asset_url text;

-- Constrain to the supported kinds. Done as a NOT VALID add + validate so it
-- never fails on any pre-existing rows (all default to 'video' anyway).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'course_lessons_type_check'
  ) then
    alter table course_lessons
      add constraint course_lessons_type_check
      check (lesson_type in ('video', 'text', 'pdf', 'image')) not valid;
    alter table course_lessons validate constraint course_lessons_type_check;
  end if;
end $$;
