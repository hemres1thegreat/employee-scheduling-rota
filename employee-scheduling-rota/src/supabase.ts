/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

// Retrieve values from import.meta.env with fallback to empty string
let rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
let rawKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Clean up any surrounding quotes or spaces that might have been included in the environment setup
const sanitize = (val: any): string => {
  if (typeof val !== 'string') return '';
  return val.replace(/^['"]|['"]$/g, '').trim();
};

const supabaseUrl = sanitize(rawUrl);
const supabaseAnonKey = sanitize(rawKey);

// Validate that it is a properly formed HTTP/HTTPS URL
const isValidUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
};

export const isSupabaseConfigured = isValidUrl(supabaseUrl) && !!supabaseAnonKey;

// Use fallback dummy values if not fully/correctly configured to prevent instant app crash
const finalUrl = isSupabaseConfigured 
  ? supabaseUrl 
  : 'https://placeholder-url-please-configure.supabase.co';

const finalKey = isSupabaseConfigured 
  ? supabaseAnonKey 
  : 'placeholder-anon-key';

export const supabase = createClient(finalUrl, finalKey);

