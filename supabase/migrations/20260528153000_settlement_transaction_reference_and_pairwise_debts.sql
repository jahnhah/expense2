-- -- Add transaction reference to settlements and enrich pairwise debt details

-- ALTER TABLE settlements
--   ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL;

-- CREATE OR REPLACE FUNCTION get_pairwise_debts(p_household_id uuid)
-- RETURNS TABLE (
--   from_member_id uuid,
--   from_name      text,
--   from_color     text,
--   to_member_id   uuid,
--   to_name        text,
--   to_color       text,
--   amount         numeric,
--   transactions   jsonb
-- )
-- LANGUAGE sql
-- STABLE
-- AS $$
--   SELECT
--     tp.member_id AS from_member_id,
--     fm.name      AS from_name,
--     fm.color     AS from_color,

--     t.payer_id   AS to_member_id,
--     tm.name      AS to_name,
--     tm.color     AS to_color,

--     ROUND(
--       SUM(COALESCE(tp.computed_share, 0) - COALESCE(tp.paid_amount, 0)),
--       2
--     ) AS amount,

--     jsonb_agg(
--       jsonb_build_object(
--         'title', t.title,
--         'date',  t.date,
--         'share', ROUND(tp.computed_share, 2),
--         'computed_share', ROUND(tp.computed_share, 2),
--         'paid_amount', ROUND(COALESCE(tp.paid_amount, 0), 2),
--         'remaining', ROUND(COALESCE(tp.computed_share, 0) - COALESCE(tp.paid_amount, 0), 2),
--         'payments', COALESCE(
--           (
--             SELECT jsonb_agg(
--               jsonb_build_object(
--                 'amount', ROUND(s2.amount, 2),
--                 'date', s2.date,
--                 'note', COALESCE(s2.note, ''),
--                 'settlement_id', s2.id,
--                 'transaction_id', s2.transaction_id
--               ) ORDER BY s2.date
--             )
--             FROM settlements s2
--             WHERE s2.household_id = t.household_id
--               AND s2.from_member_id = tp.member_id
--               AND s2.to_member_id = t.payer_id
--               AND s2.transaction_id = t.id
--           ),
--           '[]'::jsonb
--         )
--       )
--       ORDER BY t.date DESC
--     ) AS transactions

--   FROM transaction_participants tp

--   JOIN transactions t
--     ON t.id = tp.transaction_id

--   JOIN members fm
--     ON fm.id = tp.member_id

--   JOIN members tm
--     ON tm.id = t.payer_id

--   LEFT JOIN settlements s
--     ON s.household_id = t.household_id
--     AND s.from_member_id = tp.member_id
--     AND s.to_member_id = t.payer_id

--   WHERE t.household_id = p_household_id
--     AND tp.member_id <> t.payer_id
--     AND t.payer_id IS NOT NULL
--     AND tp.is_paid = false

--   GROUP BY
--     tp.member_id,
--     fm.name,
--     fm.color,
--     t.payer_id,
--     tm.name,
--     tm.color

--   HAVING
--     SUM(COALESCE(tp.computed_share, 0) - COALESCE(tp.paid_amount, 0)) > 0.01

--   ORDER BY
--     SUM(COALESCE(tp.computed_share, 0) - COALESCE(tp.paid_amount, 0)) DESC;
-- $$;
