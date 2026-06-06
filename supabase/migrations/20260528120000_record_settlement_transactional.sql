-- Transactional settlement support

ALTER TABLE transaction_participants
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION record_settlement(
  p_household_id uuid,
  p_from_member_id uuid,
  p_to_member_id uuid,
  p_amount numeric,
  p_date date,
  p_note text,
  p_transaction_participant_id uuid,
  p_transaction_id uuid
)
RETURNS TABLE (
  id uuid,
  household_id uuid,
  from_member_id uuid,
  to_member_id uuid,
  transaction_id uuid,
  amount numeric,
  date date,
  note text,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_participant transaction_participants%ROWTYPE;
  v_unpaid transaction_participants%ROWTYPE;
  v_remaining numeric;
  v_total_remaining numeric := 0;
  v_temp_amount numeric := p_amount;
BEGIN
  IF p_transaction_participant_id IS NOT NULL THEN
    -- try to lock participant by id
    SELECT *
    INTO v_participant
    FROM transaction_participants
    WHERE id = p_transaction_participant_id
    FOR UPDATE;

    IF FOUND THEN
      -- existing participant: update using current logic
      v_participant.paid_amount := COALESCE(v_participant.paid_amount, 0);
      v_participant.computed_share := COALESCE(v_participant.computed_share, 0);

      IF v_participant.computed_share <= v_participant.paid_amount + p_amount THEN
        UPDATE transaction_participants
        SET paid_amount = v_participant.paid_amount + p_amount,
            is_paid = true
        WHERE transaction_participants.id = v_participant.id;
      ELSE
        UPDATE transaction_participants
        SET paid_amount = v_participant.paid_amount + p_amount
        WHERE transaction_participants.id = v_participant.id;
      END IF;
    ELSE
      -- participant id not found: create one using provided transaction id
      IF p_transaction_id IS NULL THEN
        RAISE EXCEPTION 'transaction_id required to create missing participant';
      END IF;

      INSERT INTO transaction_participants (
        transaction_id,
        member_id,
        formula,
        computed_value,
        computed_share,
        paid_amount,
        is_paid
      ) VALUES (
        p_transaction_id,
        p_from_member_id,
        '1',
        0,
        p_amount,
        p_amount,
        true
      ) RETURNING * INTO v_participant;
    END IF;
  ELSIF p_transaction_id IS NOT NULL THEN
    PERFORM 1
    FROM transactions
    WHERE transactions.id = p_transaction_id
      AND household_id = p_household_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Transaction not found for household';
    END IF;

    SELECT *
    INTO v_participant
    FROM transaction_participants
    WHERE transaction_id = p_transaction_id
      AND member_id = p_from_member_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Transaction participant not found for settlement';
    END IF;

    v_participant.paid_amount := COALESCE(v_participant.paid_amount, 0);
    v_participant.computed_share := COALESCE(v_participant.computed_share, 0);

    IF v_participant.computed_share <= v_participant.paid_amount + p_amount THEN
      UPDATE transaction_participants
      SET paid_amount = v_participant.paid_amount + p_amount,
          is_paid = true
      WHERE transaction_participants.id = v_participant.id;
    ELSE
      UPDATE transaction_participants
      SET paid_amount = v_participant.paid_amount + p_amount
      WHERE transaction_participants.id = v_participant.id;
    END IF;
  ELSE
    FOR v_unpaid IN
      SELECT *
      FROM transaction_participants
      WHERE member_id = p_from_member_id
        AND is_paid = false
      ORDER BY created_at, transaction_participants.id
      FOR UPDATE
    LOOP
      v_remaining := COALESCE(v_unpaid.computed_share, 0) - COALESCE(v_unpaid.paid_amount, 0);

      IF v_remaining > 0 THEN
        v_total_remaining := v_total_remaining + v_remaining;
      END IF;
    END LOOP;

    IF v_temp_amount >= v_total_remaining THEN
      UPDATE transaction_participants
      SET paid_amount = COALESCE(computed_share, 0),
          is_paid = true
      WHERE member_id = p_from_member_id
        AND is_paid = false
        AND COALESCE(computed_share, 0) - COALESCE(paid_amount, 0) > 0;
    ELSIF v_temp_amount > 0 THEN
      FOR v_unpaid IN
        SELECT *
        FROM transaction_participants
        WHERE member_id = p_from_member_id
          AND is_paid = false
        ORDER BY created_at, transaction_participants.id
        FOR UPDATE
      LOOP
        v_remaining := COALESCE(v_unpaid.computed_share, 0) - COALESCE(v_unpaid.paid_amount, 0);

        IF v_remaining <= 0 THEN
          CONTINUE;
        END IF;

        IF v_temp_amount >= v_remaining THEN
          UPDATE transaction_participants
          SET paid_amount = COALESCE(computed_share, 0),
              is_paid = true
          WHERE transaction_participants.id = v_unpaid.id;

          v_temp_amount := v_temp_amount - v_remaining;
        ELSE
          UPDATE transaction_participants
          SET paid_amount = COALESCE(paid_amount, 0) + v_temp_amount
          WHERE transaction_participants.id = v_unpaid.id;

          v_temp_amount := 0;
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN QUERY
  INSERT INTO settlements (household_id, from_member_id, to_member_id, transaction_id, amount, date, note)
  VALUES (p_household_id, p_from_member_id, p_to_member_id, p_transaction_id, p_amount, p_date, trim(COALESCE(p_note, '')))
  RETURNING settlements.id, settlements.household_id, settlements.from_member_id, settlements.to_member_id, settlements.transaction_id, settlements.amount, settlements.date, settlements.note, settlements.created_at;
END;
$$;
