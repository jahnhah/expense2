export type Database = {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          currency: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          currency?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          currency?: string;
          created_at?: string;
        };
      };
      members: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          color?: string;
          created_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          default_formula: string;
          color: string;
          default_formulas: Record<string, string>;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          default_formula?: string;
          color?: string;
          default_formulas?: Record<string, string>;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          default_formula?: string;
          color?: string;
          default_formulas?: Record<string, string>;
          created_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          household_id: string;
          title: string;
          amount: number;
          payer_id: string | null;
          category_id: string | null;
          formula_override: string | null;
          date: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          title: string;
          amount: number;
          payer_id?: string | null;
          category_id?: string | null;
          formula_override?: string | null;
          date?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          title?: string;
          amount?: number;
          payer_id?: string | null;
          category_id?: string | null;
          formula_override?: string | null;
          date?: string;
          notes?: string | null;
          created_at?: string;
        };
      };
      transaction_participants: {
        Row: {
          id: string;
          transaction_id: string;
          member_id: string;
          formula: string;
          computed_value: number | null;
          computed_share: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          member_id: string;
          formula?: string;
          computed_value?: number | null;
          computed_share?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          member_id?: string;
          formula?: string;
          computed_value?: number | null;
          computed_share?: number | null;
          created_at?: string;
        };
      };
    };
  };
};
