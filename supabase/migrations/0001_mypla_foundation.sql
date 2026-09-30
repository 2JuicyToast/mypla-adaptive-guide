-- MyPLA's first schema. Every user-owned row is protected by auth.uid() RLS.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'America/New_York',
  wake_time time,
  sleep_time time,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'paused', 'done', 'archived')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'upcoming' check (status in ('current', 'upcoming', 'explore', 'done')),
  due_date date,
  estimated_minutes integer not null default 30 check (estimated_minutes >= 0),
  importance text not null default 'medium' check (importance in ('high', 'medium', 'low')),
  energy_required text not null default 'medium' check (energy_required in ('high', 'medium', 'low')),
  category text,
  course text,
  consequences text,
  is_fixed boolean not null default false,
  priority_score integer not null default 0 check (priority_score between 0 and 100),
  priority_explanation text not null default '',
  assistant_note text,
  position integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_actions (
  id text primary key,
  task_id text not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_action_id text references public.task_actions(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  energy_required text check (energy_required is null or energy_required in ('high', 'medium', 'low')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_blocks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text references public.tasks(id) on delete set null,
  title text not null,
  kind text not null check (kind in ('fixed', 'flexible', 'break', 'routine', 'transition')),
  start timestamptz not null,
  "end" timestamptz not null,
  status text not null default 'planned',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ("end" > start)
);

create table if not exists public.proposals (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proposal_type text not null,
  title text not null,
  rationale text not null default '',
  proposed_changes jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'edited', 'rejected', 'expired')),
  related_task_id text references public.tasks(id) on delete set null,
  changes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.coach_knowledge (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  statement text not null,
  confidence text not null default 'suggested' check (confidence in ('confirmed', 'observed', 'suggested')),
  source text not null default 'assistant',
  active boolean not null default true,
  user_correction text,
  related_task_id text references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resources (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'tool',
  url text,
  purpose text not null default '',
  when_useful text,
  saved_prompt text,
  personal_note text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reflections (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  week date not null,
  summary text not null default '',
  what_went_well text not null default '',
  challenges text not null default '',
  helpful_strategies text not null default '',
  things_to_remember text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week)
);

create table if not exists public.stuck_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null references public.tasks(id) on delete cascade,
  action_id text references public.task_actions(id) on delete set null,
  reason text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_status_due_idx on public.tasks(user_id, status, due_date);
create index if not exists task_actions_task_position_idx on public.task_actions(task_id, position);
create index if not exists schedule_blocks_user_start_idx on public.schedule_blocks(user_id, start);
create index if not exists proposals_user_status_idx on public.proposals(user_id, status);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_actions enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.proposals enable row level security;
alter table public.coach_knowledge enable row level security;
alter table public.resources enable row level security;
alter table public.reflections enable row level security;
alter table public.stuck_reports enable row level security;

create policy "Users manage their own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy "Users manage their own projects" on public.projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their own tasks" on public.tasks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their own task actions" on public.task_actions
  for all using (user_id = auth.uid()) with check (
    user_id = auth.uid() and exists (
      select 1 from public.tasks where tasks.id = task_actions.task_id and tasks.user_id = auth.uid()
    )
  );
create policy "Users manage their own schedule blocks" on public.schedule_blocks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their own proposals" on public.proposals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their own coach knowledge" on public.coach_knowledge
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their own resources" on public.resources
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their own reflections" on public.reflections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their own stuck reports" on public.stuck_reports
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());