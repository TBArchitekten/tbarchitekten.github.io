-- Romy Persistent Work v0.1: bounded, explicitly reviewed employee goals.
-- Mission runs cannot write Office project data or accept memories.
alter table public.office_romy_proposals
 drop constraint office_romy_proposals_kind_check;
alter table public.office_romy_proposals
 add constraint office_romy_proposals_kind_check
 check(kind in ('create_task','create_event','remember','start_mission','control_mission'));

create table public.office_romy_missions (
 id uuid primary key default gen_random_uuid(),
 proposal_id uuid not null unique references public.office_romy_proposals(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete cascade,
 conversation_id uuid not null,
 request_id uuid not null references public.office_assistant_requests(id) on delete cascade,
 objective text not null check(length(btrim(objective)) between 5 and 6000),
 completion_criterion text not null default '' check(length(completion_criterion)<=2400),
 status text not null default 'queued'
  check(status in ('queued','running','waiting_for_user','waiting_until','completed','failed','cancelled')),
 summary text not null default '' check(length(summary)<=10000),
 blocker_question text,
 iteration integer not null default 0 check(iteration between 0 and 8),
 max_iterations integer not null default 5 check(max_iterations between 1 and 8),
 next_wake_at timestamptz,
 lease_token uuid,
 lease_until timestamptz,
 error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 completed_at timestamptz,
 foreign key(conversation_id,user_id)
  references public.office_assistant_conversations(id,user_id) on delete cascade
);
create index office_romy_missions_queue_idx
 on public.office_romy_missions(status,next_wake_at,lease_until,created_at)
 where status in ('queued','running','waiting_until');
create index office_romy_missions_owner_idx
 on public.office_romy_missions(user_id,updated_at desc);
alter table public.office_romy_missions enable row level security;
revoke all on public.office_romy_missions from public,anon,authenticated;
grant select on public.office_romy_missions to authenticated;
create policy office_romy_missions_owner_read on public.office_romy_missions
 for select to authenticated using (
 user_id=(select auth.uid()) and (select private.office_is_member())
);

create table public.office_romy_mission_events (
 id uuid primary key default gen_random_uuid(),
 mission_id uuid not null references public.office_romy_missions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 iteration integer not null,
 event_type text not null
  check(event_type in ('created','claimed','progress','waiting_for_user','waiting_until','completed','failed','cancelled','resumed')),
 summary text not null default '',
 question text,
 created_at timestamptz not null default now(),
 unique(mission_id,iteration,event_type)
);
create index office_romy_mission_events_owner_idx
 on public.office_romy_mission_events(user_id,created_at desc);
alter table public.office_romy_mission_events enable row level security;
revoke all on public.office_romy_mission_events from public,anon,authenticated;
grant select on public.office_romy_mission_events to authenticated;
create policy office_romy_mission_events_owner_read on public.office_romy_mission_events
 for select to authenticated using (
  user_id=(select auth.uid()) and (select private.office_is_member())
);

-- A single invoker-restricted claim function: lease and idempotent checkpoint count.
create function public.office_romy_claim_missions(p_limit integer default 2)
returns setof public.office_romy_missions
language plpgsql security definer set search_path=pg_catalog,public as $$
declare row_id uuid; claimed public.office_romy_missions%rowtype;
begin
 for row_id in
  select m.id from public.office_romy_missions m
  join public.office_members om on om.user_id=m.user_id
   and om.is_active and not om.must_change_password
  where m.iteration < m.max_iterations and
   ((m.status in ('queued','waiting_until') and
     coalesce(m.next_wake_at,now())<=now())
    or (m.status='running' and m.lease_until<now()))
  order by m.created_at
  for update of m skip locked limit least(greatest(p_limit,1),3)
 loop
  update public.office_romy_missions
   set status='running',iteration=iteration+1,lease_token=gen_random_uuid(),
    lease_until=now()+interval '4 minutes',updated_at=now()
   where id=row_id returning * into claimed;
  insert into public.office_romy_mission_events(mission_id,user_id,iteration,event_type,summary)
   values(claimed.id,claimed.user_id,claimed.iteration,'claimed','Checkpoint reserved')
   on conflict do nothing;
  return next claimed;
 end loop;
end;
$$;
revoke all on function public.office_romy_claim_missions(integer) from public,anon,authenticated;
grant execute on function public.office_romy_claim_missions(integer) to service_role;

-- Atomic state+receipt+conversation delivery, protected by the exact worker lease.
create function public.office_romy_finish_mission(
 p_id uuid,p_lease uuid,p_status text,p_summary text,p_question text default null,
 p_next_wake timestamptz default null,p_error text default null
) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
declare m public.office_romy_missions%rowtype; ticket uuid; t text;
begin
 if p_status not in ('queued','waiting_until','waiting_for_user','completed','failed') then return false; end if;
 select * into m from public.office_romy_missions
  where id=p_id and lease_token=p_lease and status='running' for update;
 if not found then return false; end if;
 if p_status='queued' and m.iteration>=m.max_iterations then
  p_status:='waiting_for_user';p_question:='Checkpoint limit reached. Please review the result before resuming.';
 end if;
 if p_status='queued' then p_next_wake:=now()+interval '5 minutes'; end if;
 if p_status='waiting_until' and (p_next_wake is null or p_next_wake<=now()) then
  p_status:='waiting_for_user';p_question:='No grounded future wake time was provided.';
 end if;
 update public.office_romy_missions
  set status=p_status,summary=left(coalesce(p_summary,''),10000),
   blocker_question=left(p_question,3000),next_wake_at=p_next_wake,
   error=left(p_error,3000),lease_token=null,lease_until=null,
   completed_at=case when p_status in ('completed','failed') then now() else null end,
   updated_at=now()
  where id=p_id;
 insert into public.office_romy_mission_events
  (mission_id,user_id,iteration,event_type,summary,question)
  values(m.id,m.user_id,m.iteration,
   case when p_status='queued' then 'progress'
    when p_status='waiting_until' then 'waiting_until'
    else p_status end,left(coalesce(p_summary,''),10000),left(p_question,3000))
  on conflict do nothing;
 if p_status in ('completed','failed','waiting_for_user') then
   ticket:=gen_random_uuid();
   insert into public.office_assistant_requests
    (id,user_id,conversation_id,mode,status)
   values(ticket,m.user_id,m.conversation_id,'standard','completed');
   t:=case p_status when 'completed' then 'Auftrag abgeschlossen: '
     when 'failed' then 'Auftrag nicht abgeschlossen: '
     else 'Rückfrage zum laufenden Auftrag: ' end;
   insert into public.office_assistant_messages
    (conversation_id,user_id,request_id,role,content,metadata)
   values(m.conversation_id,m.user_id,ticket,'assistant',
      left(t||coalesce(p_summary,'')||
       case when nullif(p_question,'') is not null then E'\n\n'||p_question else '' end,12000),
      jsonb_build_object('mission_id',m.id,'mission_iteration',m.iteration,
       'mission_status',p_status,'provenance','office_persistent_work'));
   update public.office_assistant_conversations set updated_at=now()
    where id=m.conversation_id and user_id=m.user_id;
 end if;
 return true;
end;
$$;
revoke all on function public.office_romy_finish_mission(uuid,uuid,text,text,text,timestamptz,text)
 from public,anon,authenticated;
grant execute on function public.office_romy_finish_mission(uuid,uuid,text,text,text,timestamptz,text)
 to service_role;

comment on table public.office_romy_missions is
 'Owner-scoped approved commitments for read-only persistent work; no write-through authority.';
