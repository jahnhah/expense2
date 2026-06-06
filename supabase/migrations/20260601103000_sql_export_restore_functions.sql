-- SQL export and restore functions for household data

create or replace function export_household_sql_dump(p_household_id uuid)
returns text language plpgsql security definer as $$
declare
  dump text := '';
  member_row record;
  category_row record;
  transaction_row record;
  participant_row record;
  settlement_row record;
  household_row record;
begin
  dump := dump || format('-- SQL backup for household %s\n', p_household_id);

  for household_row in select id, name, currency, created_at from households where id = p_household_id loop
    dump := dump || format(
      'insert into households (id, name, currency, created_at) values (%L, %L, %L, %L) on conflict (id) do update set name = excluded.name, currency = excluded.currency, created_at = excluded.created_at;%s',
      household_row.id,
      household_row.name,
      household_row.currency,
      household_row.created_at,
      E'\n-- STATEMENT_END\n'
    );
  end loop;

  for member_row in select id, household_id, name, color, created_at from members where household_id = p_household_id order by created_at loop
    dump := dump || format(
      'insert into members (id, household_id, name, color, created_at) values (%L, %L, %L, %L, %L);%s',
      member_row.id,
      member_row.household_id,
      member_row.name,
      member_row.color,
      member_row.created_at,
      E'\n-- STATEMENT_END\n'
    );
  end loop;

  for category_row in select id, household_id, name, default_formula, color, default_formulas, created_at from categories where household_id = p_household_id order by name loop
    dump := dump || format(
      'insert into categories (id, household_id, name, default_formula, color, default_formulas, created_at) values (%L, %L, %L, %L, %L, %L, %L);%s',
      category_row.id,
      category_row.household_id,
      category_row.name,
      category_row.default_formula,
      category_row.color,
      category_row.default_formulas::text,
      category_row.created_at,
      E'\n-- STATEMENT_END\n'
    );
  end loop;

  for transaction_row in select id, household_id, title, amount, payer_id, category_id, formula_override, date, notes, created_at from transactions where household_id = p_household_id order by date desc, created_at desc loop
    dump := dump || format(
      'insert into transactions (id, household_id, title, amount, payer_id, category_id, formula_override, date, notes, created_at) values (%L, %L, %L, %s, %s, %s, %s, %L, %s, %L);%s',
      transaction_row.id,
      transaction_row.household_id,
      transaction_row.title,
      coalesce(transaction_row.amount::text, 'NULL'),
      coalesce(quote_nullable(transaction_row.payer_id), 'NULL'),
      coalesce(quote_nullable(transaction_row.category_id), 'NULL'),
      coalesce(quote_nullable(transaction_row.formula_override), 'NULL'),
      transaction_row.date,
      coalesce(quote_nullable(transaction_row.notes), 'NULL'),
      transaction_row.created_at,
      E'\n-- STATEMENT_END\n'
    );
  end loop;

  for participant_row in select id, transaction_id, member_id, formula, computed_value, computed_share, paid_amount, is_paid, created_at from transaction_participants where transaction_id in (select id from transactions where household_id = p_household_id) order by created_at loop
    dump := dump || format(
      'insert into transaction_participants (id, transaction_id, member_id, formula, computed_value, computed_share, paid_amount, is_paid, created_at) values (%L, %L, %L, %L, %s, %s, %s, %s, %L);%s',
      participant_row.id,
      participant_row.transaction_id,
      participant_row.member_id,
      participant_row.formula,
      coalesce(participant_row.computed_value::text, 'NULL'),
      coalesce(participant_row.computed_share::text, 'NULL'),
      coalesce(participant_row.paid_amount::text, 'NULL'),
      coalesce(quote_nullable(participant_row.is_paid::text), 'NULL'),
      participant_row.created_at,
      E'\n-- STATEMENT_END\n'
    );
  end loop;

  for settlement_row in select id, household_id, from_member_id, to_member_id, transaction_id, amount, date, note, created_at from settlements where household_id = p_household_id order by date desc, created_at desc loop
    dump := dump || format(
      'insert into settlements (id, household_id, from_member_id, to_member_id, transaction_id, amount, date, note, created_at) values (%L, %L, %L, %L, %s, %s, %L, %s, %L);%s',
      settlement_row.id,
      settlement_row.household_id,
      settlement_row.from_member_id,
      settlement_row.to_member_id,
      coalesce(quote_nullable(settlement_row.transaction_id), 'NULL'),
      coalesce(settlement_row.amount::text, 'NULL'),
      settlement_row.date,
      coalesce(quote_nullable(settlement_row.note), 'NULL'),
      settlement_row.created_at,
      E'\n-- STATEMENT_END\n'
    );
  end loop;

  return dump;
end;
$$;

create or replace function restore_household_sql_dump(p_household_id uuid, p_sql text)
returns void language plpgsql security definer as $$
declare
  statements text[];
  statement text;
begin
  delete from transaction_participants where transaction_id in (select id from transactions where household_id = p_household_id);
  delete from transactions where household_id = p_household_id;
  delete from settlements where household_id = p_household_id;
  delete from categories where household_id = p_household_id;
  delete from members where household_id = p_household_id;

  statements := string_to_array(p_sql, E'\n-- STATEMENT_END\n');
  foreach statement in array statements loop
    statement := trim(statement);
    if statement = '' then
      continue;
    end if;
    execute statement;
  end loop;
end;
$$;

grant execute on function export_household_sql_dump(uuid) to anon;
grant execute on function restore_household_sql_dump(uuid, text) to anon;
