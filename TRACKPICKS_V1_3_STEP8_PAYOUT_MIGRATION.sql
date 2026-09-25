-- TrackPicks V1.3 Step 8 (app version 1.3.8)
-- Run BEFORE deploying the Step 8 frontend.

begin;

alter table public.wagers
  add column if not exists payout_odds integer;

update public.wagers
set payout_odds = case
  when bet_type = 'Moneyline'
    then coalesce(market_moneyline, line::integer, -110)
  else -110
end
where payout_odds is null;

alter table public.wagers
  alter column payout_odds set default -110;

alter table public.wagers
  alter column payout_odds set not null;

update public.parlay_legs
set odds = -110
where odds is null
  and bet_type in ('Spread','Total');

commit;

select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'wagers' and column_name = 'payout_odds')
    or
    (table_name = 'parlay_legs' and column_name = 'odds')
  )
order by table_name, column_name;
