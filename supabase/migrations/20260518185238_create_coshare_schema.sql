/*
  # CoShare - Shared Living Expense Management Schema

  ## Overview
  Creates the full schema for household expense tracking with formula-based splitting.

  ## New Tables

  ### households
  - `id` (uuid, primary key)
  - `name` (text) - Household display name
  - `currency` (text) - ISO currency code e.g. EUR, USD
  - `created_at` (timestamp)

  ### members
  - `id` (uuid, primary key)
  - `household_id` (uuid, FK -> households)
  - `name` (text) - Member display name
  - `color` (text) - Hex color for avatar
  - `created_at` (timestamp)

  ### categories
  - `id` (uuid, primary key)
  - `household_id` (uuid, FK -> households)
  - `name` (text) - Category name (Food, Rent, etc.)
  - `default_formula` (text) - Default splitting formula type: 'proportional' | 'equal' | custom
  - `color` (text) - Hex color for visual grouping
  - `created_at` (timestamp)

  ### transactions
  - `id` (uuid, primary key)
  - `household_id` (uuid, FK -> households)
  - `title` (text) - Transaction description
  - `amount` (numeric) - Total transaction amount
  - `payer_id` (uuid, FK -> members) - Who paid
  - `category_id` (uuid, FK -> categories)
  - `formula_override` (text) - Override category-level formula
  - `date` (date) - Transaction date
  - `notes` (text, optional)
  - `created_at` (timestamp)

  ### transaction_participants
  - `id` (uuid, primary key)
  - `transaction_id` (uuid, FK -> transactions)
  - `member_id` (uuid, FK -> members)
  - `formula` (text) - Participation formula e.g. "2 * 7"
  - `computed_value` (numeric) - Evaluated formula result
  - `computed_share` (numeric) - Final monetary share
  - `created_at` (timestamp)

  ## Security
  - RLS enabled on all tables
  - Anon role can read/write (no-auth MVP)
*/

-- Households table
CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE households ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon users can read households"
  ON households FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert households"
  ON households FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update households"
  ON households FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can delete households"
  ON households FOR DELETE
  TO anon
  USING (true);

-- Members table
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon users can read members"
  ON members FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert members"
  ON members FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update members"
  ON members FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can delete members"
  ON members FOR DELETE
  TO anon
  USING (true);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name text NOT NULL,
  default_formula text NOT NULL DEFAULT 'proportional',
  color text NOT NULL DEFAULT '#10B981',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon users can read categories"
  ON categories FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert categories"
  ON categories FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update categories"
  ON categories FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can delete categories"
  ON categories FOR DELETE
  TO anon
  USING (true);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  payer_id uuid REFERENCES members(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  formula_override text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon users can read transactions"
  ON transactions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert transactions"
  ON transactions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update transactions"
  ON transactions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can delete transactions"
  ON transactions FOR DELETE
  TO anon
  USING (true);

-- Transaction participants table
CREATE TABLE IF NOT EXISTS transaction_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  formula text NOT NULL DEFAULT '1',
  computed_value numeric DEFAULT 0,
  computed_share numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(transaction_id, member_id)
);

ALTER TABLE transaction_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon users can read transaction_participants"
  ON transaction_participants FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert transaction_participants"
  ON transaction_participants FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update transaction_participants"
  ON transaction_participants FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can delete transaction_participants"
  ON transaction_participants FOR DELETE
  TO anon
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_members_household ON members(household_id);
CREATE INDEX IF NOT EXISTS idx_categories_household ON categories(household_id);
CREATE INDEX IF NOT EXISTS idx_transactions_household ON transactions(household_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_participants_transaction ON transaction_participants(transaction_id);
CREATE INDEX IF NOT EXISTS idx_participants_member ON transaction_participants(member_id);
