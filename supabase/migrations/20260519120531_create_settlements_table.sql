/*
  # Settlements Module - Reimbursement Tracking

  ## Overview
  Adds a settlements table to track reimbursements between members.
  This enables recording when debts are paid, showing remaining balances,
  and providing a full audit trail of debt resolution.

  ## New Tables

  ### settlements
  - `id` (uuid, primary key)
  - `household_id` (uuid, FK -> households) - Scope to household
  - `from_member_id` (uuid, FK -> members) - Who is paying
  - `to_member_id` (uuid, FK -> members) - Who is receiving
  - `amount` (numeric) - Amount being reimbursed
  - `date` (date) - When the reimbursement happened
  - `note` (text) - Optional description
  - `created_at` (timestamp)

  ## Security
  - RLS enabled on settlements
  - Anon access for MVP (no auth)
*/

CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  from_member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  to_member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon users can read settlements"
  ON settlements FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert settlements"
  ON settlements FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update settlements"
  ON settlements FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can delete settlements"
  ON settlements FOR DELETE
  TO anon
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_settlements_household ON settlements(household_id);
CREATE INDEX IF NOT EXISTS idx_settlements_from ON settlements(from_member_id);
CREATE INDEX IF NOT EXISTS idx_settlements_to ON settlements(to_member_id);
CREATE INDEX IF NOT EXISTS idx_settlements_date ON settlements(date DESC);
