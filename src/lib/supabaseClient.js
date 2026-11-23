import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const QuotationService = {
  async fetchAll() {
    const { data, error } = await supabase
      .from('quotations')
      .select('*')
      .order('doc_date', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async create(payload) {
    const { data, error } = await supabase
      .from('quotations')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async update(id, payload) {
    const { data, error } = await supabase
      .from('quotations')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase
      .from('quotations')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};