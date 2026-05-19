/*
  # Add default_formulas column to categories table
  
  Allows storing per-member proportional formulas as defaults when a category is used.
*/

ALTER TABLE categories
ADD COLUMN default_formulas JSONB DEFAULT '{}'::jsonb;
