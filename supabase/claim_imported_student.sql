-- Link an imported grantee record to a student's own account, WITH coordinator approval.
--
-- A coordinator imports a historical grantee list: each person gets a student record
-- with no login (users.auth_id is null). When that person later signs up and types their
-- School ID on their profile, the system does NOT link anything by itself (knowing someone's
-- School ID and name is not proof of being them). Instead:
--
--   1. the student's profile calls   request_student_link(school_id)
--      -> a "Pending" request is created if an unclaimed record with that School ID and the
--         same first + last name exists;
--   2. the coordinator sees it on the Grantees page and calls
--        approve_student_link(request_id)   or   reject_student_link(request_id, remarks)
--      -> approve moves every row on the imported student onto the student's own record
--         (all-or-nothing) and removes the empty imported one.
--
-- Run this whole file once in the Supabase SQL editor. It replaces the earlier
-- claim_imported_student() function, which linked instantly.

drop function if exists public.claim_imported_student(text);

create table if not exists public.student_link_requests (
  request_id           bigint generated always as identity primary key,
  requester_student_id bigint not null,
  imported_student_id  bigint not null,   -- no FK: this row is repointed/deleted by the merge
  school_id            text   not null,
  status               text   not null default 'Pending'
                         check (status in ('Pending','Approved','Rejected')),
  remarks              text,
  decided_by           bigint,
  decided_at           timestamptz,
  created_at           timestamptz not null default now()
);

-- one open request per student
create unique index if not exists student_link_requests_one_pending
  on public.student_link_requests (requester_student_id) where status = 'Pending';

-- Everything goes through the functions below; nobody touches the table directly.
alter table public.student_link_requests enable row level security;
revoke all on public.student_link_requests from anon, authenticated;

-- ---------------------------------------------------------------- student side
create or replace function public.request_student_link(p_school_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me_user  public.users%rowtype;
  me_stud  public.students%rowtype;
  imp_stud public.students%rowtype;
  imp_user public.users%rowtype;
begin
  select * into me_user from public.users where auth_id = auth.uid();
  if not found then return jsonb_build_object('requested', false, 'reason', 'no_account'); end if;

  select * into me_stud from public.students where user_id = me_user.user_id;
  if not found then return jsonb_build_object('requested', false, 'reason', 'no_student_record'); end if;

  select s.* into imp_stud
  from public.students s
  join public.users u on u.user_id = s.user_id
  where s.school_id = trim(p_school_id)
    and u.auth_id is null
    and s.student_id <> me_stud.student_id
  limit 1;
  if not found then return jsonb_build_object('requested', false, 'reason', 'nothing_to_link'); end if;

  select * into imp_user from public.users where user_id = imp_stud.user_id;
  if lower(trim(imp_user.last_name))  <> lower(trim(me_user.last_name))
  or lower(trim(imp_user.first_name)) <> lower(trim(me_user.first_name)) then
    return jsonb_build_object('requested', false, 'reason', 'name_mismatch');
  end if;

  if exists (select 1 from public.student_link_requests
             where requester_student_id = me_stud.student_id and status = 'Pending') then
    return jsonb_build_object('requested', true, 'already', true);
  end if;

  insert into public.student_link_requests (requester_student_id, imported_student_id, school_id)
  values (me_stud.student_id, imp_stud.student_id, trim(p_school_id));

  return jsonb_build_object('requested', true);
end;
$$;

-- ----------------------------------------------------------- coordinator side
create or replace function public.is_coordinator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.users where auth_id = auth.uid() and role = 'Coordinator');
$$;

-- pending requests with the names a coordinator needs to decide
create or replace function public.list_student_link_requests()
returns table (
  request_id bigint, school_id text, created_at timestamptz,
  requester_name text, requester_email text,
  imported_name text, imported_course text, scholarships text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_coordinator() then raise exception 'Coordinators only'; end if;
  return query
  select r.request_id, r.school_id, r.created_at,
         trim(coalesce(ru.first_name,'') || ' ' || coalesce(ru.last_name,'')),
         ru.email,
         trim(coalesce(iu.first_name,'') || ' ' || coalesce(iu.last_name,'')),
         ist.course,
         (select string_agg(distinct sc.scholarship_name, ', ')
            from public.grantees g
            join public.scholarships sc on sc.scholarship_id = g.scholarship_id
           where g.student_id = r.imported_student_id)
  from public.student_link_requests r
  join public.students rs  on rs.student_id = r.requester_student_id
  join public.users    ru  on ru.user_id    = rs.user_id
  left join public.students ist on ist.student_id = r.imported_student_id
  left join public.users    iu  on iu.user_id     = ist.user_id
  where r.status = 'Pending'
  order by r.created_at;
end;
$$;

create or replace function public.approve_student_link(p_request_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req      public.student_link_requests%rowtype;
  me_user  public.users%rowtype;
  me_stud  public.students%rowtype;
  imp_stud public.students%rowtype;
  imp_user public.users%rowtype;
  coord    bigint;
  fk       record;
  dup      record;
begin
  if not public.is_coordinator() then raise exception 'Coordinators only'; end if;
  select user_id into coord from public.users where auth_id = auth.uid();

  select * into req from public.student_link_requests
   where request_id = p_request_id and status = 'Pending' for update;
  if not found then return jsonb_build_object('approved', false, 'reason', 'not_pending'); end if;

  select * into me_stud  from public.students where student_id = req.requester_student_id;
  select * into me_user  from public.users    where user_id    = me_stud.user_id;
  select * into imp_stud from public.students where student_id = req.imported_student_id;
  if not found then
    update public.student_link_requests set status='Rejected', remarks='Imported record no longer exists',
           decided_by=coord, decided_at=now() where request_id = req.request_id;
    return jsonb_build_object('approved', false, 'reason', 'record_gone');
  end if;
  select * into imp_user from public.users where user_id = imp_stud.user_id;

  -- the record must still be unclaimed
  if imp_user.auth_id is not null then
    return jsonb_build_object('approved', false, 'reason', 'already_claimed');
  end if;

  -- If the student already has a grantee row for the same scholarship, school year and semester
  -- (they applied and were approved in the system), the imported copy would count twice
  -- against the slots. Fold the imported copy into the existing one: move whatever points at it
  -- (releases, verifications, ...) over, then delete it.
  for dup in
    select i.grantee_id as dup_id, m.grantee_id as keep_id
    from public.grantees i
    join public.grantees m
      on m.student_id = me_stud.student_id
     and m.scholarship_id = i.scholarship_id
     and m.academic_year is not distinct from i.academic_year
     and m.semester      is not distinct from i.semester
    where i.student_id = imp_stud.student_id
  loop
    for fk in
      select c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f'
        and c.confrelid = 'public.grantees'::regclass
        and array_length(c.conkey, 1) = 1
    loop
      execute format('update %s set %I = $1 where %I = $2', fk.tbl, fk.col, fk.col)
        using dup.keep_id, dup.dup_id;
    end loop;
    delete from public.grantees where grantee_id = dup.dup_id;
  end loop;

  -- move every row that points at the imported student onto the requester's record
  for fk in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.students'::regclass
      and array_length(c.conkey, 1) = 1
  loop
    execute format('update %s set %I = $1 where %I = $2', fk.tbl, fk.col, fk.col)
      using me_stud.student_id, imp_stud.student_id;
  end loop;

  update public.students set
    course         = coalesce(nullif(course, ''), imp_stud.course),
    year_level     = coalesce(year_level, imp_stud.year_level),
    contact_number = coalesce(nullif(contact_number, ''), imp_stud.contact_number)
  where student_id = me_stud.student_id;

  delete from public.students where student_id = imp_stud.student_id;
  delete from public.users    where user_id    = imp_user.user_id;
  update public.students set school_id = req.school_id where student_id = me_stud.student_id;

  update public.student_link_requests
     set status='Approved', decided_by=coord, decided_at=now()
   where request_id = req.request_id;

  return jsonb_build_object('approved', true, 'student_user_id', me_user.user_id);
end;
$$;

create or replace function public.reject_student_link(p_request_id bigint, p_remarks text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req   public.student_link_requests%rowtype;
  coord bigint;
  uid   bigint;
begin
  if not public.is_coordinator() then raise exception 'Coordinators only'; end if;
  select user_id into coord from public.users where auth_id = auth.uid();

  select * into req from public.student_link_requests
   where request_id = p_request_id and status = 'Pending' for update;
  if not found then return jsonb_build_object('rejected', false, 'reason', 'not_pending'); end if;

  update public.student_link_requests
     set status='Rejected', remarks=nullif(trim(p_remarks),''), decided_by=coord, decided_at=now()
   where request_id = req.request_id;

  select user_id into uid from public.students where student_id = req.requester_student_id;
  return jsonb_build_object('rejected', true, 'student_user_id', uid);
end;
$$;

-- the student can see where their own request stands
create or replace function public.my_student_link_request()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(x) from (
    select r.status, r.remarks, r.school_id, r.created_at
    from public.student_link_requests r
    join public.students s on s.student_id = r.requester_student_id
    join public.users u on u.user_id = s.user_id
    where u.auth_id = auth.uid()
    order by r.created_at desc limit 1
  ) x;
$$;

revoke all on function public.request_student_link(text)            from public;
revoke all on function public.is_coordinator()                      from public;
revoke all on function public.list_student_link_requests()          from public;
revoke all on function public.approve_student_link(bigint)          from public;
revoke all on function public.reject_student_link(bigint, text)     from public;
revoke all on function public.my_student_link_request()             from public;
grant execute on function public.request_student_link(text)         to authenticated;
grant execute on function public.is_coordinator()                   to authenticated;
grant execute on function public.list_student_link_requests()       to authenticated;
grant execute on function public.approve_student_link(bigint)       to authenticated;
grant execute on function public.reject_student_link(bigint, text)  to authenticated;
grant execute on function public.my_student_link_request()          to authenticated;
