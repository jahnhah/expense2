/*
  # Dashboard Computed Functions

  Moves all JS-side computation from calculations.ts into PostgreSQL functions
  so the API returns ready-to-render data, not raw rows.

  ## Functions

  ### get_member_balances(p_household_id uuid)
  Returns per-member balance aggregates:
    member_id, name, color,
    total_paid, total_owed, total_reimbursed, total_received, balance

  ### get_category_breakdown(p_household_id uuid)
  Returns spending totals per category, sorted descending by total:
    category_id, name, color, total

  ### get_member_spending(p_household_id uuid)
  Returns per-member paid vs owed breakdown:
    member_id, name, color, paid, owed

  ### get_suggested_settlements(p_household_id uuid)
  Returns the minimal set of transfers to settle all debts:
    from_member_id, from_name, to_member_id, to_name, amount
*/

-- ─────────────────────────────────────────────
-- 1. get_member_balances
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_member_balances(p_household_id uuid)
RETURNS TABLE (
  member_id        uuid,
  name             text,
  color            text,
  total_paid       numeric,
  total_owed       numeric,
  total_reimbursed numeric,
  total_received   numeric,
  balance          numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    m.id                                               AS member_id,
    m.name,
    m.color,
    COALESCE(paid.total, 0)                            AS total_paid,
    COALESCE(owed.total, 0)                            AS total_owed,
    COALESCE(reimbursed.total, 0)                      AS total_reimbursed,
    COALESCE(received.total, 0)                        AS total_received,
    ROUND(
      COALESCE(paid.total, 0)
      - COALESCE(owed.total, 0)
      - COALESCE(received.total, 0)
      + COALESCE(reimbursed.total, 0),
    2)                                                 AS balance
  FROM members m

  -- What each member paid as the payer
  LEFT JOIN (
    SELECT payer_id AS member_id, SUM(amount) AS total
    FROM transactions
    WHERE household_id = p_household_id
    GROUP BY payer_id
  ) paid ON paid.member_id = m.id

  -- What each member owes (their computed_share across all transactions they participate in)
  LEFT JOIN (
    SELECT tp.member_id, SUM(tp.computed_share) AS total
    FROM transaction_participants tp
    JOIN transactions t ON t.id = tp.transaction_id
    WHERE t.household_id = p_household_id
    GROUP BY tp.member_id
  ) owed ON owed.member_id = m.id

  -- What each member sent as settlements (reimbursed others)
  LEFT JOIN (
    SELECT from_member_id AS member_id, SUM(amount) AS total
    FROM settlements
    WHERE household_id = p_household_id
    GROUP BY from_member_id
  ) reimbursed ON reimbursed.member_id = m.id

  -- What each member received as settlements
  LEFT JOIN (
    SELECT to_member_id AS member_id, SUM(amount) AS total
    FROM settlements
    WHERE household_id = p_household_id
    GROUP BY to_member_id
  ) received ON received.member_id = m.id

  WHERE m.household_id = p_household_id
  ORDER BY m.created_at;
$$;

-- ─────────────────────────────────────────────
-- 2. get_category_breakdown
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_category_breakdown(p_household_id uuid)
RETURNS TABLE (
  category_id uuid,
  name        text,
  color       text,
  total       numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(t.category_id, '00000000-0000-0000-0000-000000000000'::uuid) AS category_id,
    COALESCE(c.name, 'Uncategorized')                                      AS name,
    COALESCE(c.color, '#6B7280')                                           AS color,
    ROUND(SUM(t.amount), 2)                                                AS total
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  WHERE t.household_id = p_household_id
  GROUP BY t.category_id, c.name, c.color
  ORDER BY total DESC;
$$;

-- ─────────────────────────────────────────────
-- 3. get_member_spending
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_member_spending(p_household_id uuid)
RETURNS TABLE (
  member_id uuid,
  name      text,
  color     text,
  paid      numeric,
  owed      numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    m.id   AS member_id,
    m.name,
    m.color,
    ROUND(COALESCE(paid.total, 0), 2) AS paid,
    ROUND(COALESCE(owed.total, 0), 2) AS owed
  FROM members m

  LEFT JOIN (
    SELECT payer_id AS member_id, SUM(amount) AS total
    FROM transactions
    WHERE household_id = p_household_id
    GROUP BY payer_id
  ) paid ON paid.member_id = m.id

  LEFT JOIN (
    SELECT tp.member_id, SUM(tp.computed_share) AS total
    FROM transaction_participants tp
    JOIN transactions t ON t.id = tp.transaction_id
    WHERE t.household_id = p_household_id
    GROUP BY tp.member_id
  ) owed ON owed.member_id = m.id

  WHERE m.household_id = p_household_id
  ORDER BY m.created_at;
$$;

-- ─────────────────────────────────────────────
-- 4. get_suggested_settlements
--    Greedy min-transfer algorithm implemented in PL/pgSQL.
--    Mirrors the JS computeSettlements() logic exactly.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_suggested_settlements(p_household_id uuid)
RETURNS TABLE (
  from_member_id uuid,
  from_name      text,
  to_member_id   uuid,
  to_name        text,
  amount         numeric
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  debtor_id    uuid;
  creditor_id  uuid;
  debtor_amt   numeric;
  creditor_amt numeric;
  transfer     numeric;
BEGIN
  CREATE TEMP TABLE _debtors ON COMMIT DROP AS
    SELECT member_id, (-balance) AS amount
    FROM get_member_balances(p_household_id)
    WHERE balance < -0.01
    ORDER BY balance ASC;

  CREATE TEMP TABLE _creditors ON COMMIT DROP AS
    SELECT member_id, balance AS amount
    FROM get_member_balances(p_household_id)
    WHERE balance > 0.01
    ORDER BY balance DESC;

  LOOP
    SELECT d.member_id, d.amount
    INTO debtor_id, debtor_amt
    FROM _debtors d
    WHERE d.amount > 0.01
    ORDER BY d.amount DESC
    LIMIT 1;

    SELECT c.member_id, c.amount
    INTO creditor_id, creditor_amt
    FROM _creditors c
    WHERE c.amount > 0.01
    ORDER BY c.amount DESC
    LIMIT 1;

    EXIT WHEN debtor_id IS NULL OR creditor_id IS NULL;

    transfer := LEAST(debtor_amt, creditor_amt);

    IF transfer > 0.01 THEN
      RETURN QUERY
      SELECT
        debtor_id,
        m1.name,
        creditor_id,
        m2.name,
        ROUND(transfer, 2)
      FROM members m1, members m2
      WHERE m1.id = debtor_id
        AND m2.id = creditor_id;
    END IF;

    UPDATE _debtors d
    SET amount = d.amount - transfer
    WHERE d.member_id = debtor_id;

    UPDATE _creditors c
    SET amount = c.amount - transfer
    WHERE c.member_id = creditor_id;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────
-- 5. get_pairwise_debts
--    For each (debtor → creditor) pair, returns total owed minus any
--    settlements already made, and a JSONB array of contributing
--    transactions for drill-down display.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_pairwise_debts(p_household_id uuid)
RETURNS TABLE (
  from_member_id uuid,
  from_name text,
  from_color text,
  to_member_id uuid,
  to_name text,
  to_color text,
  amount numeric,
  transaction_details jsonb
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    tp.member_id AS from_member_id,
    fm.name AS from_name,
    fm.color AS from_color,
    t.payer_id AS to_member_id,
    tm.name AS to_name,
    tm.color AS to_color,

    ROUND(
      SUM(tp.computed_share - tp.paid_amount),
      2
    ) AS amount,

    jsonb_build_object(
      'id', t.id,
      'title', t.title,
      'date', t.date,
      'computedShare', ROUND(SUM(tp.computed_share), 2),
      'paidAmount', ROUND(SUM(tp.paid_amount), 2),
      'remaining', ROUND(SUM(tp.computed_share - tp.paid_amount), 2),
      'transaction_participant_id', tp.id
    ) AS transaction_details

  FROM transaction_participants tp
  JOIN transactions t
    ON t.id = tp.transaction_id
  JOIN members fm
    ON fm.id = tp.member_id
  JOIN members tm
    ON tm.id = t.payer_id

  WHERE t.household_id = p_household_id

  GROUP BY
    t.id,
    t.title,
    t.date,
    tp.id,
    tp.member_id,
    fm.name,
    fm.color,
    t.payer_id,
    tm.name,
    tm.color

  HAVING
    SUM(tp.computed_share - tp.paid_amount) > 0

  ORDER BY
    MAX(tp.created_at) DESC;
$$;

CREATE OR REPLACE FUNCTION get_total_expenses(p_household_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE household_id = p_household_id;
$$;
 

-- Grant execute to anon role (matches existing RLS policy stance)
GRANT EXECUTE ON FUNCTION get_member_balances(uuid)       TO anon;
GRANT EXECUTE ON FUNCTION get_category_breakdown(uuid)    TO anon;
GRANT EXECUTE ON FUNCTION get_member_spending(uuid)       TO anon;
GRANT EXECUTE ON FUNCTION get_suggested_settlements(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_pairwise_debts(uuid)        TO anon;
