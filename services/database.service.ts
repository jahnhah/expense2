import { supabase } from '@/lib/supabase';

export const DatabaseService = {
  async exportSqlDump(householdId: string): Promise<string> {
    const { data, error } = await supabase.rpc('export_household_sql_dump', {
      p_household_id: householdId,
    });

    if (error) {
      throw error;
    }

    return data ?? '';
  },

  async restoreSqlDump(householdId: string, sqlDump: string): Promise<void> {
    const { error } = await supabase.rpc('restore_household_sql_dump', {
      p_household_id: householdId,
      p_sql: sqlDump,
    });

    if (error) {
      throw error;
    }
  },
};
