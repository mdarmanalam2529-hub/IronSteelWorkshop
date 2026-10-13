import { supabase } from './supabase';

export const api = {
  get: async (endpoint: string) => {
    // 1. Try local SQLite API first (served by Express & proxied by Vite)
    try {
      const res = await fetch(`/api/${endpoint}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Local API unavailable or network glitch; fall through to Supabase
    }

    // 2. Fallback to Supabase
    const [table, id] = endpoint.split('/');
    const cleanTable = table.split('?')[0];

    if (id) {
      const { data, error } = await supabase.from(cleanTable).select('*').eq('id', id).single();
      if (error) throw new Error(error.message);
      return data;
    } else {
      const { data, error } = await supabase
        .from(cleanTable)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    }
  },

  post: async (endpoint: string, data: any) => {
    let localResult = null;

    // 1. Try local SQLite API first
    try {
      const res = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        localResult = await res.json();
      }
    } catch {
      // Ignore local failure
    }

    // 2. Also sync to Supabase if available
    const [table] = endpoint.split('/');
    try {
      const { data: supaResult, error } = await supabase
        .from(table)
        .insert(data)
        .select()
        .single();
      if (!error && supaResult) {
        return localResult || supaResult;
      }
    } catch {
      // Supabase offline or RLS
    }

    if (localResult) return localResult;
    throw new Error(`Failed to save record to ${table}`);
  },

  patch: async (endpoint: string, data: any) => {
    const [table, id] = endpoint.split('/');
    if (!id) throw new Error('ID required for PATCH');

    let localResult = null;

    // 1. Try local SQLite API first
    try {
      const res = await fetch(`/api/${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        localResult = await res.json();
      }
    } catch {
      // Ignore local failure
    }

    // 2. Also sync to Supabase
    try {
      const { data: supaResult, error } = await supabase
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (!error && supaResult) {
        return localResult || supaResult;
      }
    } catch {
      // Supabase offline
    }

    if (localResult) return localResult;
    return { success: true };
  },

  delete: async (endpoint: string) => {
    const [table, id] = endpoint.split('/');
    if (!id) throw new Error('ID required for DELETE');

    // 1. Try local SQLite API first
    try {
      await fetch(`/api/${endpoint}`, { method: 'DELETE' });
    } catch {
      // Ignore local failure
    }

    // 2. Also sync to Supabase
    try {
      await supabase.from(table).delete().eq('id', id);
    } catch {
      // Supabase offline
    }

    return { success: true };
  },
};
