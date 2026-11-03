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
  on public.expenses (user_id, month_key  );

  alter table public.expenses
    add column if not exists category text;

  update public.expenses
  set category = 'Egyéb'
  where source = 'extra'
    and category is null;

  alter table public.expenses
    drop constraint if exists expenses_category_check;

  alter table public.expenses
    add constraint expenses_category_check
    check (
      category is null
      or category in ('Bevásárlás', 'Revolut', 'Autószerelés', 'Ruha', 'Egyéb')
    );

  alter table public.expenses
    add column if not exists template_id text;

with ranked_expenses as (
  select
    id,
    first_value(id) over (
      partition by user_id, month_key, name
      order by created_at, id
    ) as keeper_id,
    bool_or(paid) over (
      partition by user_id, month_key, name
    ) as any_paid
  from public.expenses
  where source = 'excel'
)
update public.expenses as expense
set paid = ranked.any_paid
from ranked_expenses as ranked
where expense.id = ranked.keeper_id;

with ranked_expenses as (
  select
    id,
    row_number() over (
      partition by user_id, month_key, name
      order by created_at, id
    ) as row_number
  from public.expenses
  where source = 'excel'
)
delete from public.expenses as expense
using ranked_expenses as ranked
where expense.id = ranked.id
  and ranked.row_number > 1;

update public.expenses
set
  name = 'BKK Bérlet Eszti',
  amount = 9450,
  frequency = 'Havi'
where source = 'excel'
  and name = 'BKK bérlet Eszti/Norbi';

insert into public.expenses (
  user_id, month_key, month_label, name, frequency, amount,
  due_date, paid, note, source, template_id
)
select
  user_id, month_key, month_label, 'BKK Bérlet Norbi', 'Havi', 9450,
  due_date, paid, note, 'excel', 'BKK Bérlet Norbi'
from public.expenses as original
where original.source = 'excel'
  and original.name = 'BKK Bérlet Eszti'
  and not exists (
    select 1
    from public.expenses as existing
    where existing.user_id = original.user_id
      and existing.month_key = original.month_key
      and existing.source = 'excel'
      and existing.name = 'BKK Bérlet Norbi'
  );

update public.expenses
set
  name = 'Magyar Államkincstár Bíbor',
  amount = 21115,
  frequency = 'Havi'
where source = 'excel'
  and name = 'Magyar Államkincstár Julcsi/Bíbor';

insert into public.expenses (
  user_id, month_key, month_label, name, frequency, amount,
  due_date, paid, note, source, template_id
)
select
  user_id, month_key, month_label, 'Magyar Államkincstár Julcsi', 'Havi', 21115,
  due_date, paid, note, 'excel', 'Magyar Államkincstár Julcsi'
from public.expenses as original
where original.source = 'excel'
  and original.name = 'Magyar Államkincstár Bíbor'
  and not exists (
    select 1
    from public.expenses as existing
    where existing.user_id = original.user_id
      and existing.month_key = original.month_key
      and existing.source = 'excel'
      and existing.name = 'Magyar Államkincstár Julcsi'
  );

update public.expenses
set template_id = name
where source = 'excel'
  and template_id is null;

create unique index if not exists expenses_user_month_template_idx
  on public.expenses (user_id, month_key, template_id);

update public.expenses
set paid = true
where source = 'excel'
  and name in (
    'Spotify',
    'Netflix',
    'Disney+',
    'Crunchyroll',
    'Apple Cloud+',
    'Kifli előfizetés',
    'YouTube',
    'Humble Bundle'
  );

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
