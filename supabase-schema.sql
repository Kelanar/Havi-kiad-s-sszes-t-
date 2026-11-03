create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null check (month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  month_label text not null,
  name text not null check (char_length(name) between 1 and 100),
  frequency text not null check (frequency in ('Havi', 'Kéthavi', 'Egyszeri')),
  amount numeric(12, 2) not null check (amount > 0),
  due_date date,
  paid boolean not null default false,
  note text not null default '' check (char_length(note) <= 250),
  source text not null check (source in ('excel', 'extra')),
  created_at timestamptz not null default now()
);

create index if not exists expenses_user_month_idx
  on public.expenses (user_id, month_key);

alter table public.expenses enable row level security;

drop policy if exists "Users can read their own expenses" on public.expenses;
create policy "Users can read their own expenses"
  on public.expenses for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their own expenses" on public.expenses;
create policy "Users can add their own expenses"
  on public.expenses for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own expenses" on public.expenses;
create policy "Users can update their own expenses"
  on public.expenses for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own expenses" on public.expenses;
create policy "Users can delete their own expenses"
  on public.expenses for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.expenses to authenticated;
