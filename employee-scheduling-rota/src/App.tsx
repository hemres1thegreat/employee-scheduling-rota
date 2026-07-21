/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, Users, Clock, LogOut, Settings, Mail, Key, UserCheck, 
  ArrowRight, AlertTriangle, ShieldCheck, Calendar as CalendarIcon,
  CalendarDays, UserPlus, UserMinus, PlusCircle, AlertCircle, Sparkles, 
  FileText, Phone, Briefcase, Plus, Check, Coins, ShieldAlert, 
  FileSpreadsheet, Trash2, ChevronLeft, ChevronRight, Eye, EyeOff
} from 'lucide-react';
import { createClient, User as SupabaseUser } from '@supabase/supabase-js';

// Initialize supabase directly using the hardcoded credentials
export const supabase = createClient("https://undylmbxyqbndepxpda.supabase.co", "sb_publishable_pRLDrl4iU4x33H5V");
export const isSupabaseConfigured = true;
export const supabaseConfigMissing = false;


// --- Type Definitions ---
export type UserRole = 'Admin' | 'General Manager' | 'Regular Staff';
export type ShiftType = 'Morning' | 'Afternoon';

export interface Staff {
  id: string;
  name: string;
  role: string;
  color: string;
  avatarUrl?: string;
  phone?: string;
  hourlyRate?: number;
  bonusAdjustment?: number;
  email?: string;
  status?: 'active' | 'pending';
  is_approved?: boolean;
}

export interface Shift {
  id: string;
  dateString: string;
  type: ShiftType;
  startTime: string;
  endTime: string;
  assignedStaffIds: string[];
  notes?: string;
  requestedStaffIds?: string[];
}

export interface DayShiftConfig {
  morning: { start: string; end: string };
  afternoon: { start: string; end: string };
  isOpen: boolean;
}

// --- Rota Scheduling Constants & Helper Functions ---
const APPLE_COLOR_PALETTE = [
  { value: '#0A84FF', label: 'Blue' },
  { value: '#30D158', label: 'Green' },
  { value: '#FF9F0A', label: 'Orange' },
  { value: '#BF5AF2', label: 'Purple' },
  { value: '#FF453A', label: 'Red' },
  { value: '#64D2FF', label: 'Teal' },
  { value: '#FF375F', label: 'Rose' },
  { value: '#5E5CE6', label: 'Indigo' },
];

export function getDayShiftConfig(dayOfWeek: number): DayShiftConfig {
  if (dayOfWeek === 0) {
    return { morning: { start: '', end: '' }, afternoon: { start: '', end: '' }, isOpen: false };
  }
  if (dayOfWeek >= 1 && dayOfWeek <= 4) {
    return { morning: { start: '09:30', end: '14:30' }, afternoon: { start: '14:30', end: '19:00' }, isOpen: true };
  }
  return { morning: { start: '10:30', end: '14:30' }, afternoon: { start: '14:30', end: '19:00' }, isOpen: true };
}

export function formatDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function generateMonthData(year: number, month: number): Date[] {
  const result: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = firstDay.getDay();
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDayOfWeek);
  for (let i = 0; i < 42; i++) {
    result.push(new Date(startDate));
    startDate.setDate(startDate.getDate() + 1);
  }
  return result;
}

export function calculateShiftHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  let diff = (eh + em / 60) - (sh + sm / 60);
  if (diff < 0) diff += 24;
  return diff;
}

export function calculateStaffPayroll(shifts: Shift[], staffList: Staff[]) {
  const stats: { [id: string]: { hours: number; rawPay: number; cappedPay: number; shiftsCount: number; hasCapApplied: boolean } } = {};
  staffList.forEach(s => {
    stats[s.id] = { hours: 0, rawPay: 0, cappedPay: 0, shiftsCount: 0, hasCapApplied: false };
  });

  const shiftsByDate: { [date: string]: Shift[] } = {};
  shifts.forEach(shift => {
    if (!shiftsByDate[shift.dateString]) shiftsByDate[shift.dateString] = [];
    shiftsByDate[shift.dateString].push(shift);
  });

  Object.entries(shiftsByDate).forEach(([_, dayShifts]) => {
    const dayStaffStats: { [id: string]: { hours: number; pay: number } } = {};
    dayShifts.forEach(shift => {
      const duration = calculateShiftHours(shift.startTime, shift.endTime);
      shift.assignedStaffIds.forEach(staffId => {
        const emp = staffList.find(s => s.id === staffId);
        const rate = emp?.hourlyRate ?? 10.00;
        if (!dayStaffStats[staffId]) dayStaffStats[staffId] = { hours: 0, pay: 0 };
        dayStaffStats[staffId].hours += duration;
        dayStaffStats[staffId].pay += duration * rate;
      });
    });

    Object.entries(dayStaffStats).forEach(([staffId, dStats]) => {
      if (!stats[staffId]) stats[staffId] = { hours: 0, rawPay: 0, cappedPay: 0, shiftsCount: 0, hasCapApplied: false };
      stats[staffId].hours += dStats.hours;
      stats[staffId].rawPay += dStats.pay;
      const dailyCapped = Math.min(80, dStats.pay);
      stats[staffId].cappedPay += dailyCapped;
      if (dStats.pay > 80) stats[staffId].hasCapApplied = true;
      stats[staffId].shiftsCount += dayShifts.filter(s => s.assignedStaffIds.includes(staffId)).length;
    });
  });

  return stats;
}

// --- Local Storage fallback state ---
const getLocalStaff = (): Staff[] => {
  try { return JSON.parse(localStorage.getItem('rota_staff') || '[]'); } catch { return []; }
};
const getLocalShifts = (): Shift[] => {
  try { return JSON.parse(localStorage.getItem('rota_shifts') || '[]'); } catch { return []; }
};
const saveLocalStaff = (st: Staff[]) => localStorage.setItem('rota_staff', JSON.stringify(st));
const saveLocalShifts = (sh: Shift[]) => localStorage.setItem('rota_shifts', JSON.stringify(sh));

const getDeletedStaffIds = (): string[] => {
  try { return JSON.parse(localStorage.getItem('rota_deleted_staff_ids') || '[]'); } catch { return []; }
};
const saveDeletedStaffId = (id: string) => {
  try {
    const deleted = getDeletedStaffIds();
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem('rota_deleted_staff_ids', JSON.stringify(deleted));
    }
  } catch {}
};

const getDeletedShiftIds = (): string[] => {
  try { return JSON.parse(localStorage.getItem('rota_deleted_shift_ids') || '[]'); } catch { return []; }
};
const saveDeletedShiftId = (id: string) => {
  try {
    const deleted = getDeletedShiftIds();
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem('rota_deleted_shift_ids', JSON.stringify(deleted));
    }
  } catch {}
};

const mapDbStaff = (row: any): Staff => {
  let finalName = (row.name || row.fullName || row.full_name || '').trim();
  if (!finalName && row.email) {
    finalName = row.email.split('@')[0];
  }
  if (!finalName) {
    finalName = 'Staff Member';
  }
  let status: 'active' | 'pending' = 'active';
  if (row.status === 'pending' || row.is_approved === false) {
    status = 'pending';
  }
  return {
    id: row.id,
    name: finalName,
    role: row.role || 'Sales Associate',
    color: row.color || '#0A84FF',
    avatarUrl: row.avatarUrl || row.avatar_url,
    phone: row.phone || 'Unlisted',
    hourlyRate: typeof row.hourlyRate === 'number' ? row.hourlyRate : (typeof row.hourly_rate === 'number' ? row.hourly_rate : 10.00),
    bonusAdjustment: typeof row.bonusAdjustment === 'number' ? row.bonusAdjustment : (typeof row.bonus_adjustment === 'number' ? row.bonus_adjustment : 0),
    email: row.email || '',
    status: status,
    is_approved: row.is_approved !== undefined ? row.is_approved : (status === 'active')
  };
};

const dbStaffObject = (s: Staff) => ({
  id: s.id, name: s.name, role: s.role, color: s.color, phone: s.phone || 'Unlisted',
  hourly_rate: s.hourlyRate ?? 10.00, hourlyRate: s.hourlyRate ?? 10.00,
  bonus_adjustment: s.bonusAdjustment ?? 0, bonusAdjustment: s.bonusAdjustment ?? 0, email: s.email || '',
  status: s.status || 'active',
  is_approved: s.is_approved !== undefined ? s.is_approved : (s.status !== 'pending')
});

const parseArrayField = (field: any): string[] => {
  if (Array.isArray(field)) return field;
  if (typeof field === 'string') {
    const trimmed = field.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {}
    }
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const cleaned = trimmed.slice(1, -1);
      if (!cleaned) return [];
      return cleaned.split(',').map(s => s.replace(/^"|"$/g, '').trim()).filter(Boolean);
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
};

const mapDbShift = (row: any): Shift => ({
  id: row.id,
  dateString: row.dateString || row.date_string || '',
  type: row.type || 'Morning',
  startTime: row.startTime || row.start_time || '09:30',
  endTime: row.endTime || row.end_time || '14:30',
  assignedStaffIds: parseArrayField(row.assignedStaffIds !== undefined ? row.assignedStaffIds : row.assigned_staff_ids),
  notes: row.notes || '',
  requestedStaffIds: parseArrayField(row.requestedStaffIds !== undefined ? row.requestedStaffIds : row.requested_staff_ids)
});

const dbShiftObject = (s: Shift) => ({
  id: s.id, dateString: s.dateString, date_string: s.dateString, type: s.type,
  startTime: s.startTime, start_time: s.startTime, endTime: s.endTime, end_time: s.endTime,
  assignedStaffIds: s.assignedStaffIds || [], assigned_staff_ids: s.assignedStaffIds || [], notes: s.notes || '',
  requestedStaffIds: s.requestedStaffIds || [], requested_staff_ids: s.requestedStaffIds || []
});

let staffSubscribers: ((st: Staff[]) => void)[] = [];
let shiftsSubscribers: ((sh: Shift[]) => void)[] = [];
let settingsSubscribers: ((se: { allowPublicSignUp: boolean }) => void)[] = [];

let currentStaffState = getLocalStaff();
let currentShiftsState = getLocalShifts();
let currentSettingsState = { allowPublicSignUp: true };

try {
  const allowVal = localStorage.getItem('rota_public_signup');
  if (allowVal) currentSettingsState.allowPublicSignUp = JSON.parse(allowVal);
} catch {}

const notifyStaff = () => staffSubscribers.forEach(cb => cb([...currentStaffState]));
const notifyShifts = () => shiftsSubscribers.forEach(cb => cb([...currentShiftsState]));
const notifySettings = () => settingsSubscribers.forEach(cb => cb({ ...currentSettingsState }));

let detectedColumnKeys: Record<string, string[]> = {
  profiles: [],
  shifts: [],
  settings: []
};
let detectedArrayFormat: Record<string, 'none' | 'postgres' | 'json' | 'comma'> = {
  profiles: 'none',
  shifts: 'none',
  settings: 'none'
};

function formatPayloadArrays(payload: any, format: 'json' | 'postgres' | 'comma' | 'none') {
  const result = { ...payload };
  Object.keys(result).forEach(key => {
    const val = result[key];
    if (Array.isArray(val)) {
      if (format === 'json') {
        result[key] = JSON.stringify(val);
      } else if (format === 'postgres') {
        const escaped = val.map(item => {
          const str = String(item);
          if (str.includes(',') || str.includes('"') || str.includes('\\') || str.includes('{') || str.includes('}')) {
            return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
          }
          return str;
        });
        result[key] = `{${escaped.join(',')}}`;
      } else if (format === 'comma') {
        result[key] = val.join(',');
      }
    }
  });
  return result;
}

const getKeysForStyle = (payload: any, style: string) => {
  if (style === 'dual') return payload;
  const filtered: any = {};
  Object.keys(payload).forEach(k => {
    if (style === 'snake') {
      if (!/[A-Z]/.test(k) || k === 'id') {
        filtered[k] = payload[k];
      }
    } else if (style === 'camel') {
      if (!k.includes('_') || k === 'id') {
        filtered[k] = payload[k];
      }
    }
  });
  return filtered;
};

async function safeUpsert(tableName: string, payload: any) {
  if (!isSupabaseConfigured) return { data: null, error: null };

  const knownKeys = detectedColumnKeys[tableName] || [];
  const knownFormat = detectedArrayFormat[tableName] || 'none';

  if (knownKeys.length > 0) {
    let filteredPayload: any = {};
    Object.keys(payload).forEach(k => {
      if (knownKeys.includes(k)) {
        filteredPayload[k] = payload[k];
      }
    });
    filteredPayload = formatPayloadArrays(filteredPayload, knownFormat);
    const { data, error } = await supabase.from(tableName).upsert(filteredPayload);
    if (!error) {
      return { data, error };
    }
    console.warn(`Upsert with known schema failed. Resetting schema cache for ${tableName}...`, error);
    detectedColumnKeys[tableName] = [];
  }

  const keyStyles = ['dual', 'snake', 'camel'];
  const arrayFormats: ('none' | 'postgres' | 'json' | 'comma')[] = ['none', 'postgres', 'json', 'comma'];

  let lastError: any = null;

  for (const style of keyStyles) {
    for (const format of arrayFormats) {
      let candidate = getKeysForStyle(payload, style);
      candidate = formatPayloadArrays(candidate, format);

      try {
        const { data, error } = await supabase.from(tableName).upsert(candidate);
        if (!error) {
          detectedColumnKeys[tableName] = Object.keys(candidate);
          detectedArrayFormat[tableName] = format;
          console.log(`Successfully learned schema for ${tableName}:`, { keys: detectedColumnKeys[tableName], format });
          return { data, error };
        }
        lastError = error;
      } catch (err) {
        lastError = err;
      }
    }
  }

  console.error(`All upsert attempts failed for ${tableName}:`, lastError);
  return { data: null, error: lastError };
}

let isFirstFetchCompleted = false;

const fetchFromSupabase = async () => {
  if (!isSupabaseConfigured) return;
  try {
    const { data: dbProfiles } = await supabase.from('profiles').select('*');
    if (dbProfiles) {
      if (dbProfiles.length > 0) {
        detectedColumnKeys['profiles'] = Object.keys(dbProfiles[0]);
      }
      const dbStaff = dbProfiles.map(mapDbStaff);
      const deletedStaffIds = getDeletedStaffIds();

      // Filter out database profiles that have been deleted locally
      let mergedStaff = dbStaff.filter(s => !deletedStaffIds.includes(s.id));

      // Keep any local profiles that are not in the database and not deleted
      currentStaffState.forEach(localStaff => {
        if (!deletedStaffIds.includes(localStaff.id) && !mergedStaff.some(s => s.id === localStaff.id)) {
          mergedStaff.push(localStaff);
        }
      });

      currentStaffState = mergedStaff;
      saveLocalStaff(currentStaffState);
      notifyStaff();
    }
    const { data: dbShifts } = await supabase.from('shifts').select('*');
    if (dbShifts) {
      if (dbShifts.length > 0) {
        detectedColumnKeys['shifts'] = Object.keys(dbShifts[0]);
      }
      const dbSh = dbShifts.map(mapDbShift);
      const deletedShiftIds = getDeletedShiftIds();

      // Filter out database shifts that have been deleted locally
      let mergedShifts = dbSh.filter(s => !deletedShiftIds.includes(s.id));

      // Keep any local shifts that are not in the database and not deleted
      currentShiftsState.forEach(localShift => {
        if (!deletedShiftIds.includes(localShift.id) && !mergedShifts.some(s => s.id === localShift.id)) {
          mergedShifts.push(localShift);
        }
      });

      currentShiftsState = mergedShifts;
      saveLocalShifts(currentShiftsState);
      notifyShifts();
    }
    const { data: dbSettings } = await supabase.from('settings').select('*').eq('id', 'registration').single();
    if (dbSettings) {
      detectedColumnKeys['settings'] = Object.keys(dbSettings);
      const allow = dbSettings.allowPublicSignUp !== undefined ? dbSettings.allowPublicSignUp : dbSettings.allow_public_sign_up;
      if (typeof allow === 'boolean') {
        currentSettingsState.allowPublicSignUp = allow;
        localStorage.setItem('rota_public_signup', JSON.stringify(allow));
        notifySettings();
      }
    }
    isFirstFetchCompleted = true;
  } catch (err) {
    console.warn('Fallback to local storage:', err);
    isFirstFetchCompleted = true;
  }
};

export function subscribeToStaff(onUpdate: (staff: Staff[]) => void) {
  staffSubscribers.push(onUpdate);
  onUpdate([...currentStaffState]);
  return () => { staffSubscribers = staffSubscribers.filter(cb => cb !== onUpdate); };
}
export function subscribeToShifts(onUpdate: (shifts: Shift[]) => void) {
  shiftsSubscribers.push(onUpdate);
  onUpdate([...currentShiftsState]);
  return () => { shiftsSubscribers = shiftsSubscribers.filter(cb => cb !== onUpdate); };
}
export function subscribeToRegistrationSettings(onUpdate: (se: any) => void) {
  settingsSubscribers.push(onUpdate);
  onUpdate({ ...currentSettingsState });
  return () => { settingsSubscribers = settingsSubscribers.filter(cb => cb !== onUpdate); };
}

export async function addOrUpdateShiftInFirestore(shift: Shift) {
  try {
    const deleted = getDeletedShiftIds();
    if (deleted.includes(shift.id)) {
      const filtered = deleted.filter(id => id !== shift.id);
      localStorage.setItem('rota_deleted_shift_ids', JSON.stringify(filtered));
    }
  } catch {}
  const index = currentShiftsState.findIndex(s => s.id === shift.id);
  if (index >= 0) currentShiftsState[index] = shift;
  else currentShiftsState.push(shift);
  saveLocalShifts(currentShiftsState);
  notifyShifts();
  if (isSupabaseConfigured) {
    try { await safeUpsert('shifts', dbShiftObject(shift)); } catch (err) { console.error(err); }
  }
}

export async function deleteShiftFromFirestore(id: string) {
  saveDeletedShiftId(id);
  currentShiftsState = currentShiftsState.filter(s => s.id !== id);
  saveLocalShifts(currentShiftsState);
  notifyShifts();
  if (isSupabaseConfigured) {
    try { await supabase.from('shifts').delete().eq('id', id); } catch (err) { console.error(err); }
  }
}

export async function addStaffToFirestore(member: Staff) {
  try {
    const deleted = getDeletedStaffIds();
    if (deleted.includes(member.id)) {
      const filtered = deleted.filter(id => id !== member.id);
      localStorage.setItem('rota_deleted_staff_ids', JSON.stringify(filtered));
    }
  } catch {}
  const index = currentStaffState.findIndex(s => s.id === member.id);
  if (index >= 0) currentStaffState[index] = member;
  else currentStaffState.push(member);
  saveLocalStaff(currentStaffState);
  notifyStaff();
  if (isSupabaseConfigured) {
    try { await safeUpsert('profiles', dbStaffObject(member)); } catch (err) { console.error(err); }
  }
}

export async function updateStaffInFirestore(id: string, updates: Partial<Staff>) {
  currentStaffState = currentStaffState.map(s => s.id === id ? { ...s, ...updates } : s);
  saveLocalStaff(currentStaffState);
  notifyStaff();
  if (isSupabaseConfigured) {
    const cur = currentStaffState.find(s => s.id === id);
    if (cur) {
      try { await safeUpsert('profiles', dbStaffObject(cur)); } catch (err) { console.error(err); }
    }
  }
}

export async function deleteStaffFromFirestore(id: string) {
  saveDeletedStaffId(id);
  currentStaffState = currentStaffState.filter(s => s.id !== id);
  saveLocalStaff(currentStaffState);
  notifyStaff();
  if (isSupabaseConfigured) {
    try { await supabase.from('profiles').delete().eq('id', id); } catch (err) { console.error(err); }
  }
}

export async function updateRegistrationSettingsInFirestore(allow: boolean) {
  currentSettingsState.allowPublicSignUp = allow;
  localStorage.setItem('rota_public_signup', JSON.stringify(allow));
  notifySettings();
  if (isSupabaseConfigured) {
    try { await safeUpsert('settings', { id: 'registration', allowPublicSignUp: allow, allow_public_sign_up: allow }); } catch (err) { console.error(err); }
  }
}

if (typeof window !== 'undefined') {
  (window as any).subscribeToStaff = subscribeToStaff;
  (window as any).subscribeToShifts = subscribeToShifts;
  (window as any).addOrUpdateShiftInFirestore = addOrUpdateShiftInFirestore;
  (window as any).deleteShiftFromFirestore = deleteShiftFromFirestore;
  (window as any).addStaffToFirestore = addStaffToFirestore;
  (window as any).updateStaffInFirestore = updateStaffInFirestore;
  (window as any).deleteStaffFromFirestore = deleteStaffFromFirestore;
  (window as any).subscribeToRegistrationSettings = subscribeToRegistrationSettings;
  (window as any).updateRegistrationSettingsInFirestore = updateRegistrationSettingsInFirestore;
}

// --- SUB-COMPONENT 1: CalendarSection ---
interface CalendarSectionProps {
  selectedDateStr: string;
  onSelectDate: (d: string) => void;
  shifts: Shift[];
  staff: Staff[];
  viewMode: 'month' | 'week';
  setViewMode: (m: 'month' | 'week') => void;
  currentYear: number;
  currentMonth: number;
  setCurrentYear: (y: number) => void;
  setCurrentMonth: (m: number) => void;
}

function CalendarSection({
  selectedDateStr, onSelectDate, shifts, staff, viewMode, setViewMode,
  currentYear, currentMonth, setCurrentYear, setCurrentMonth
}: CalendarSectionProps) {
  const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const handlePrevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else { setCurrentMonth(currentMonth - 1); }
  };
  const handleNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else { setCurrentMonth(currentMonth + 1); }
  };

  const daysMatrix = generateMonthData(currentYear, currentMonth);
  const getShiftsForDate = (dStr: string) => shifts.filter(s => s.dateString === dStr);

  const getWeekDays = (): Date[] => {
    const sel = parseDateString(selectedDateStr);
    const dayOfWeek = sel.getDay();
    const result: Date[] = [];
    const sun = new Date(sel);
    sun.setDate(sel.getDate() - dayOfWeek);
    for (let i = 0; i < 7; i++) {
      const d = new Date(sun);
      d.setDate(sun.getDate() + i);
      result.push(d);
    }
    return result;
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 min-w-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 flex-shrink-0">
        <div className="bg-slate-150 p-0.5 rounded-lg flex items-center border border-slate-200 shadow-xs">
          <button onClick={() => setViewMode('month')} className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-md transition-all font-semibold ${viewMode === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            <CalendarIcon className="w-4 h-4 text-amber-500" /> <span>Month</span>
          </button>
          <button onClick={() => setViewMode('week')} className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-md transition-all font-semibold ${viewMode === 'week' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            <CalendarDays className="w-4 h-4 text-amber-500" /> <span>Week</span>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handlePrevMonth} className="p-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-600"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-xs font-bold text-slate-800 min-w-[100px] text-center">{MONTHS[currentMonth]} {currentYear}</span>
          <button onClick={handleNextMonth} className="p-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-600"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 min-h-0 select-none">
        <AnimatePresence mode="wait">
          {viewMode === 'month' ? (
            <motion.div key="month-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
              <div className="grid grid-cols-7 text-center mb-1 text-[10px] font-bold text-slate-500 font-mono tracking-wider uppercase">
                {DAYS_SHORT.map((d, i) => <div key={d} className={i === 0 ? 'text-red-600' : ''}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1 flex-1 min-h-0">
                {daysMatrix.map((date, idx) => {
                  const dStr = formatDateString(date);
                  const isSelected = dStr === selectedDateStr;
                  const isCurrentMonth = date.getMonth() === currentMonth;
                  const isSunday = date.getDay() === 0;
                  const dShifts = getShiftsForDate(dStr);
                  const isToday = formatDateString(new Date()) === dStr;

                  return (
                    <button key={`${dStr}-${idx}`} onClick={() => onSelectDate(dStr)} className={`relative min-h-[50px] p-1 flex flex-col justify-between text-left rounded-lg border transition ${isSelected ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-300' : isToday ? 'bg-red-50 border-red-200' : 'bg-slate-50/40 border-slate-200 hover:bg-slate-50'} ${!isCurrentMonth ? 'opacity-35' : ''}`}>
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-[10px] font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center ${isSelected && !isSunday ? 'bg-amber-400 text-slate-9end' : isToday ? 'bg-red-500 text-white' : isSunday ? 'text-red-500' : 'text-slate-800'}`}>{date.getDate()}</span>
                        {isSunday && <span className="text-[7px] font-black text-red-500 tracking-tighter uppercase">Closed</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-0.5 w-full min-h-[12px]">
                        {!isSunday ? (
                          dShifts.flatMap(s => s.assignedStaffIds).slice(0, 3).map((stId, sIdx) => {
                            const emp = staff.find(st => st.id === stId);
                            if (!emp) return null;
                            return (
                              <span key={`${stId}-${sIdx}`} className="text-[7px] font-bold px-0.5 py-0.5 rounded leading-none text-slate-900 border border-black/10 shrink-0" style={{ backgroundColor: emp.color }}>
                                {emp.name.split(' ').map(n => n[0]).join('')}
                              </span>
                            );
                          })
                        ) : (
                          <div className="w-full h-0.5 bg-slate-200 opacity-60"></div>
                        )}
                        {!isSunday && dShifts.length > 0 && dShifts.some(sh => sh.assignedStaffIds.length === 0) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse my-auto ml-0.5"></span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div key="week-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {getWeekDays().map((date) => {
                const dStr = formatDateString(date);
                const isSelected = dStr === selectedDateStr;
                const isSunday = date.getDay() === 0;
                const dShifts = getShiftsForDate(dStr);
                const isToday = formatDateString(new Date()) === dStr;

                return (
                  <button key={dStr} onClick={() => onSelectDate(dStr)} className={`text-left p-2.5 rounded-xl border transition-all ${isSelected ? 'bg-slate-50 border-amber-400 shadow-sm' : isToday ? 'bg-red-50 border-red-100' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                      <span className={`text-xs font-bold ${isSunday ? 'text-red-500' : 'text-slate-700'}`}>{DAYS_SHORT[date.getDay()]} {date.getDate()}</span>
                      {isToday && <span className="text-[8px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-bold uppercase">Today</span>}
                      {isSunday && <span className="text-[8px] bg-red-50 text-red-600 px-1 py-0.5 rounded border border-red-200 font-bold uppercase">Closed</span>}
                    </div>
                    <div className="mt-2 space-y-1 w-full">
                      {isSunday ? (
                        <p className="text-[10px] text-slate-400 italic">Store Closed</p>
                      ) : dShifts.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic">No shifts configured</p>
                      ) : (
                        dShifts.map(s => (
                          <div key={s.id} className="bg-slate-50 p-1.5 rounded border border-slate-150 flex items-center justify-between text-[10px]">
                            <div>
                              <span className="font-bold text-slate-700 uppercase mr-1">{s.type}</span>
                              <span className="text-slate-500 font-mono text-[9px]">{s.startTime}-{s.endTime}</span>
                            </div>
                            <div className="flex gap-0.5">
                              {s.assignedStaffIds.length === 0 ? (
                                <span className="text-[8px] text-orange-600 font-bold">Unassigned</span>
                              ) : (
                                s.assignedStaffIds.map(stId => {
                                  const st = staff.find(e => e.id === stId);
                                  return st ? <span key={stId} className="text-[8px] font-bold px-1 rounded shadow-xs" style={{ backgroundColor: st.color }}>{st.name.split(' ')[0]}</span> : null;
                                })
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="p-1 px-3 border-t border-slate-200 bg-slate-50 text-[9px] text-slate-500 flex justify-between select-none">
        <span>● Active staff directory: {staff.length}</span>
        <span>Tap any date grid square to set schedule</span>
      </div>
    </div>
  );
}

// --- SUB-COMPONENT 2: ShiftDetailsController ---
interface ShiftDetailsControllerProps {
  selectedDateStr: string;
  shifts: Shift[];
  staff: Staff[];
  onAddOrUpdateShift: (s: Shift) => void;
  onRemoveShift: (id: string) => void;
  userRole: UserRole;
}

function ShiftDetailsController({
  selectedDateStr, shifts, staff, onAddOrUpdateShift, onRemoveShift, userRole
}: ShiftDetailsControllerProps) {
  const [selectedStaffToAdd, setSelectedStaffToAdd] = useState<{ [key: string]: string }>({});
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [clickedStaffId, setClickedStaffId] = useState<{ shiftId: string; staffId: string } | null>(null);

  const [customType, setCustomType] = useState<ShiftType>('Morning');
  const [customStart, setCustomStart] = useState('09:30');
  const [customEnd, setCustomEnd] = useState('14:30');
  const [customNote, setCustomNote] = useState('');

  const parsedDate = parseDateString(selectedDateStr);
  const config = getDayShiftConfig(parsedDate.getDay());
  const dayShifts = shifts.filter(s => s.dateString === selectedDateStr);

  const handleCreateDefaults = () => {
    if (!config.isOpen) return;
    onAddOrUpdateShift({ id: `s-${selectedDateStr}-M`, dateString: selectedDateStr, type: 'Morning', startTime: config.morning.start, endTime: config.morning.end, assignedStaffIds: [], notes: '' });
    onAddOrUpdateShift({ id: `s-${selectedDateStr}-A`, dateString: selectedDateStr, type: 'Afternoon', startTime: config.afternoon.start, endTime: config.afternoon.end, assignedStaffIds: [], notes: '' });
  };

  const handleAssign = (shiftId: string) => {
    const staffId = selectedStaffToAdd[shiftId];
    if (!staffId) return;
    const s = shifts.find(sh => sh.id === shiftId);
    if (!s) return;
    if (s.assignedStaffIds.includes(staffId)) { alert("Already assigned"); return; }
    if (s.assignedStaffIds.length >= 2) { alert("Max shift size is 2 people"); return; }
    onAddOrUpdateShift({ ...s, assignedStaffIds: [...s.assignedStaffIds, staffId] });
    setSelectedStaffToAdd(prev => ({ ...prev, [shiftId]: '' }));
  };

  const handleRemove = (shiftId: string, staffId: string) => {
    const s = shifts.find(sh => sh.id === shiftId);
    if (!s) return;
    onAddOrUpdateShift({ ...s, assignedStaffIds: s.assignedStaffIds.filter(id => id !== staffId) });
  };

  const handleUpdateNotes = (shiftId: string, nText: string) => {
    const s = shifts.find(sh => sh.id === shiftId);
    if (!s) return;
    onAddOrUpdateShift({ ...s, notes: nText });
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    onAddOrUpdateShift({ id: `custom-${selectedDateStr}-${Date.now()}`, dateString: selectedDateStr, type: customType, startTime: customStart, endTime: customEnd, assignedStaffIds: [], notes: customNote });
    setIsAddingCustom(false);
    setCustomNote('');
  };

  return (
    <div className="flex flex-col h-full bg-white p-3 overflow-y-auto">
      <div className="mb-3">
        <span className="text-amber-500 text-[10px] font-extrabold uppercase flex items-center gap-1"><CalendarDays className="w-4 h-4" /> Shift Planner</span>
        <h2 className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5">{parsedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2>
      </div>

      {!config.isOpen ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <AlertCircle className="w-6 h-6 text-red-500 mb-1" />
          <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest">Store Closed</h3>
          <p className="text-[10px] text-slate-400">Trading shifts are unavailable on Sundays.</p>
        </div>
      ) : dayShifts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Sparkles className="w-6 h-6 text-amber-500 mb-1" />
          <h3 className="text-xs font-bold text-slate-800 mb-1">Slots Unconfigured</h3>
          <p className="text-[10px] text-slate-400 mb-3 text-center">Quick build the daily opening templates based on store rules.</p>
          <div className="flex gap-2">
            <button onClick={handleCreateDefaults} className="bg-amber-400 text-black font-extrabold text-[10px] py-1.5 px-3 rounded shadow hover:bg-amber-500 transition cursor-pointer">Default Shifts</button>
            <button onClick={() => setIsAddingCustom(true)} className="bg-slate-100 text-slate-700 text-[10px] py-1.5 px-2.5 rounded border border-slate-200">Ad-hoc Slot</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 flex-1 select-none">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {dayShifts.map(s => {
              const currentCap = s.assignedStaffIds.length;
              return (
                <div key={s.id} className={`p-3 rounded-xl border flex flex-col justify-between ${currentCap >= 2 ? 'border-emerald-200 bg-emerald-50/15' : currentCap === 0 ? 'border-orange-200 bg-orange-50/15' : 'border-slate-200 bg-slate-50/40'}`}>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${s.type === 'Morning' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'}`}>{s.type}</span>
                      <span className="text-[9px] font-mono text-slate-500">{s.startTime}-{s.endTime}</span>
                    </div>

                    <div className="space-y-1 mb-2">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Scheduled staff ({currentCap}/2)</span>
                      {currentCap === 0 ? (
                        <p className="text-[9px] text-orange-600 bg-white border border-orange-100 p-1.5 rounded italic flex items-center gap-1 select-none animate-pulse"><AlertCircle className="w-3.5 h-3.5" /> No staff scheduled</p>
                      ) : (
                        s.assignedStaffIds.map(stId => {
                          const emp = staff.find(e => e.id === stId);
                          if (!emp) return null;
                          const isAdminOrGM = userRole === 'Admin' || userRole === 'General Manager';
                          const isClicked = clickedStaffId?.shiftId === s.id && clickedStaffId?.staffId === stId;

                          return (
                            <div key={stId} className="flex flex-col">
                              <button onClick={() => isAdminOrGM && setClickedStaffId(isClicked ? null : { shiftId: s.id, staffId: stId })} className="w-full text-left p-1 text-[10px] font-extrabold rounded flex items-center justify-between text-black transition" style={{ backgroundColor: emp.color }}>
                                <span className="truncate">{emp.name} ({emp.role})</span>
                                <span className="text-[7px] uppercase tracking-wider bg-black/15 px-1 py-0.5 rounded">{isClicked ? 'Close' : 'Remove'}</span>
                              </button>
                              {isClicked && (
                                <div className="mt-0.5 p-1 bg-red-50 border border-red-200 rounded flex items-center justify-between">
                                  <span className="text-[8px] text-red-700">Delete from slot?</span>
                                  <button onClick={() => { handleRemove(s.id, stId); setClickedStaffId(null); }} className="bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">Delete</button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                    <select value={selectedStaffToAdd[s.id] || ''} onChange={e => setSelectedStaffToAdd(prev => ({ ...prev, [s.id]: e.target.value }))} disabled={currentCap >= 2} className="flex-1 bg-white border border-slate-200 text-[10px] p-1 rounded outline-none">
                      <option value="">+ Add...</option>
                      {staff.map(st => <option key={st.id} value={st.id} disabled={s.assignedStaffIds.includes(st.id)}>{st.name} ({st.role})</option>)}
                    </select>
                    <button onClick={() => handleAssign(s.id)} disabled={currentCap >= 2 || !selectedStaffToAdd[s.id]} className="bg-amber-400 p-1 rounded font-bold hover:bg-amber-500 cursor-pointer"><UserPlus className="w-4 h-4" /></button>
                    <button onClick={() => onRemoveShift(s.id)} className="p-1 border border-slate-200 rounded text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </div>

                  <div className="mt-2 bg-slate-50 p-1 rounded flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <input type="text" placeholder="Shift detail/notes..." value={s.notes || ''} onChange={e => handleUpdateNotes(s.id, e.target.value)} className="bg-transparent border-none text-[8px] text-slate-600 w-full outline-none placeholder:text-slate-400" />
                  </div>
                </div>
              );
            })}

            <button onClick={() => { setCustomType('Morning'); setCustomStart(config.morning.start || '09:30'); setCustomEnd(config.morning.end || '14:30'); setIsAddingCustom(true); }} className="p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-amber-300 flex flex-col items-center justify-center text-slate-400 hover:text-amber-500 transition cursor-pointer">
              <PlusCircle className="w-5 h-5" />
              <span className="text-[10px] font-bold mt-1">Add Custom Slot</span>
            </button>
          </div>
        </div>
      )}

      {/* Custom Slot Modal */}
      <AnimatePresence>
        {isAddingCustom && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="fixed inset-x-4 bottom-4 md:inset-auto md:right-8 md:top-24 md:w-[280px] bg-white border border-slate-200 rounded-xl p-4 shadow-xl z-50">
            <div className="flex justify-between items-center pb-1.5 border-b border-slate-100 mb-2">
              <h4 className="text-[10px] font-black uppercase text-slate-800 flex items-center gap-1"><Sparkles className="w-4.5 h-4.5" /> Ad-hoc custom slot</h4>
              <button onClick={() => setIsAddingCustom(false)} className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Exit</button>
            </div>
            <form onSubmit={handleAddCustom} className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase block">Pattern</label>
                  <select value={customType} onChange={e => setCustomType(e.target.value as ShiftType)} className="w-full bg-white border rounded p-1 text-[10px]">
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                  </select>
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase block">Operation</label>
                  <button type="button" onClick={() => { if (customType === 'Morning') { setCustomStart(config.morning.start || '09:30'); setCustomEnd(config.morning.end || '14:30'); } else { setCustomStart(config.afternoon.start || '14:30'); setCustomEnd(config.afternoon.end || '19:00'); } }} className="w-full bg-slate-100 text-slate-700 rounded p-1 text-[9px] font-bold">Sync Hours</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase block">Start</label>
                  <input type="text" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full border rounded p-1 text-[10px] font-mono" required />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase block">End</label>
                  <input type="text" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full border rounded p-1 text-[10px] font-mono" required />
                </div>
              </div>
              <div>
                <label className="text-[8px] font-bold text-slate-400 uppercase block">Internal Memo</label>
                <input type="text" value={customNote} onChange={e => setCustomNote(e.target.value)} placeholder="e.g. Stock check assistance" className="w-full border rounded p-1 text-[10px]" />
              </div>
              <button type="submit" className="w-full bg-amber-400 font-extrabold text-[10px] py-1.5 px-2 rounded cursor-pointer">Create custom shift</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- SUB-COMPONENT 3: StaffManager ---
interface StaffManagerProps {
  staff: Staff[];
  onAddStaff: (s: Staff) => void;
  onUpdateStaffMember: (id: string, updates: Partial<Staff>) => void;
  onDeleteStaff: (id: string) => void;
  onAssignStaffToShifts: (id: string, shIds: string[]) => void;
  onRequestStaffShifts?: (id: string, shIds: string[]) => void;
  onApproveShiftRequest?: (id: string, shId: string) => void;
  onRejectShiftRequest?: (id: string, shId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  shifts: Shift[];
  userRole: UserRole;
}

function StaffManager({
  staff, onAddStaff, onUpdateStaffMember, onDeleteStaff, onAssignStaffToShifts,
  onRequestStaffShifts, onApproveShiftRequest, onRejectShiftRequest, isOpen, onClose, shifts, userRole
}: StaffManagerProps) {
  const [activeTab, setActiveTab] = useState<'roster' | 'payroll'>('roster');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [customHourlyRate, setCustomHourlyRate] = useState('10.00');
  const [selectedColor, setSelectedColor] = useState('#0A84FF');

  const [selectedStaffIdForProfile, setSelectedStaffIdForProfile] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [selectedShiftIdsForAssign, setSelectedShiftIdsForAssign] = useState<string[]>([]);

  const [selectedCycleId, setSelectedCycleId] = useState<string>('cycle-2');
  const [customStartDateStr, setCustomStartDateStr] = useState<string>('2026-06-15');
  const [morningPayMode, setMorningPayMode] = useState<'flat' | 'hourly'>('flat');

  const [paidRecords, setPaidRecords] = useState<{ [pKey: string]: { [id: string]: boolean } }>(() => {
    try { return JSON.parse(localStorage.getItem('payroll_paid_records') || '{}'); } catch { return {}; }
  });

  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editHourlyRate, setEditHourlyRate] = useState('10.00');
  const [editColor, setEditColor] = useState('#0A84FF');

  const selectedStaffForProfile = staff.find(s => s.id === selectedStaffIdForProfile) || null;

  useEffect(() => {
    if (selectedStaffForProfile) {
      setEditName(selectedStaffForProfile.name);
      setEditRole(selectedStaffForProfile.role);
      setEditPhone(selectedStaffForProfile.phone || '');
      setEditHourlyRate((selectedStaffForProfile.hourlyRate ?? 10.00).toString());
      setEditColor(selectedStaffForProfile.color || '#0A84FF');
    }
  }, [selectedStaffIdForProfile]);

  useEffect(() => {
    localStorage.setItem('payroll_paid_records', JSON.stringify(paidRecords));
  }, [paidRecords]);

  const PREDEFINED_CYCLES = [
    { id: 'cycle-1', label: 'Week 1 & 2 (01 Jun - 14 Jun 2026)', start: '2026-06-01', end: '2026-06-14' },
    { id: 'cycle-2', label: 'Week 3 & 4 (15 Jun - 28 Jun 2026)', start: '2026-06-15', end: '2026-06-28' },
    { id: 'cycle-3', label: 'Week 5 & 6 (29 Jun - 12 Jul 2026)', start: '2026-06-29', end: '2026-07-12' },
    { id: 'cycle-4', label: 'Week 7 & 8 (13 Jul - 26 Jul 2026)', start: '2026-07-13', end: '2026-07-26' },
    { id: 'custom', label: 'Custom 2-Week Period...', start: '', end: '' },
  ];

  const getSelectedRange = () => {
    if (selectedCycleId === 'custom') {
      const start = parseDateString(customStartDateStr);
      const end = new Date(start);
      end.setDate(start.getDate() + 13);
      return { start: customStartDateStr, end: formatDateString(end) };
    }
    const cycle = PREDEFINED_CYCLES.find(c => c.id === selectedCycleId);
    return { start: cycle?.start || '2026-06-15', end: cycle?.end || '2026-06-28' };
  };

  const { start: rangeStart, end: rangeEnd } = getSelectedRange();
  const periodKey = `${rangeStart}_${rangeEnd}`;

  const computeBiWeeklyPayroll = () => {
    const stats: { [id: string]: { hours: number; cappedPay: number; hasCapApplied: boolean; doubleCount: number } } = {};
    staff.forEach(emp => {
      stats[emp.id] = { hours: 0, cappedPay: 0, hasCapApplied: false, doubleCount: 0 };
    });

    const periodShifts = shifts.filter(s => s.dateString >= rangeStart && s.dateString <= rangeEnd);
    const shiftsByDate: { [date: string]: Shift[] } = {};
    periodShifts.forEach(shift => {
      if (!shiftsByDate[shift.dateString]) shiftsByDate[shift.dateString] = [];
      shiftsByDate[shift.dateString].push(shift);
    });

    staff.forEach(emp => {
      const rate = emp.hourlyRate ?? 10.00;
      Object.entries(shiftsByDate).forEach(([_, dayShifts]) => {
        const empShifts = dayShifts.filter(s => s.assignedStaffIds.includes(emp.id));
        if (empShifts.length === 0) return;
        const hasMorning = empShifts.some(s => s.type === 'Morning');
        const hasAfternoon = empShifts.some(s => s.type === 'Afternoon');

        let dayHours = 0;
        let dayPay = 0;

        if (hasMorning && hasAfternoon) {
          stats[emp.id].doubleCount += 1;
          empShifts.forEach(s => { dayHours += calculateShiftHours(s.startTime, s.endTime); });
          dayPay = 80.00; // Capped double-shift daily flat rate
          stats[emp.id].hasCapApplied = true;
        } else if (hasMorning) {
          const m = empShifts.find(s => s.type === 'Morning')!;
          const h = calculateShiftHours(m.startTime, m.endTime);
          dayHours = h;
          dayPay = morningPayMode === 'flat' ? 50.00 : h * rate;
        } else if (hasAfternoon) {
          const a = empShifts.find(s => s.type === 'Afternoon')!;
          const h = calculateShiftHours(a.startTime, a.endTime);
          dayHours = h;
          dayPay = h * rate;
        }
        stats[emp.id].hours += dayHours;
        stats[emp.id].cappedPay += dayPay;
      });
    });

    return stats;
  };

  const biWeeklyStats = computeBiWeeklyPayroll();
  const togglePaidStatus = (stId: string) => {
    setPaidRecords(prev => {
      const curP = prev[periodKey] || {};
      return { ...prev, [periodKey]: { ...curP, [stId]: !curP[stId] } };
    });
  };

  const handleExportCSV = () => {
    let csv = "Employee,Total Hours,Total Compensation,Status\r\n";
    staff.forEach(emp => {
      const st = biWeeklyStats[emp.id] || { hours: 0, cappedPay: 0 };
      const adj = emp.bonusAdjustment ?? 0;
      const isPaid = !!paidRecords[periodKey]?.[emp.id];
      csv += `"${emp.name}",${st.hours.toFixed(1)},£${(st.cappedPay + adj).toFixed(2)},${isPaid ? 'Paid' : 'Unpaid'}\r\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `payroll_${rangeStart}_to_${rangeEnd}.csv`;
    link.click();
  };

  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !role) return;
    const valRate = isNaN(parseFloat(customHourlyRate)) ? 10.00 : parseFloat(customHourlyRate);
    onAddStaff({ id: `staff-${Date.now()}`, name, role, phone: phone || 'Unlisted', color: selectedColor, hourlyRate: valRate, bonusAdjustment: 0 });
    setName(''); setRole(''); setPhone(''); setCustomHourlyRate('10.00');
  };

  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const handleSaveProfileChanges = async () => {
    if (!selectedStaffForProfile) return;
    try {
      const rateVal = parseFloat(editHourlyRate) || 10.00;
      await onUpdateStaffMember(selectedStaffForProfile.id, {
        name: editName,
        role: editRole,
        phone: editPhone,
        hourlyRate: rateVal,
        color: editColor
      });
      setSaveSuccessMsg('Changes saved successfully!');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    } catch (err: any) {
      setSaveSuccessMsg('Error saving changes');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    }
  };

  const getShiftsCountForStaff = (id: string) => shifts.filter(s => s.assignedStaffIds.includes(id)).length;

  const todayStr = formatDateString(new Date());
  const openShifts = selectedStaffForProfile ? shifts.filter(s => !s.assignedStaffIds.includes(selectedStaffForProfile.id) && s.dateString >= todayStr) : [];
  const pendingRequestsForThisStaff = selectedStaffForProfile ? shifts.filter(s => s.requestedStaffIds?.includes(selectedStaffForProfile.id) && s.dateString >= todayStr) : [];

  const pendingRequestItems: Array<{ shift: Shift; emp: Staff }> = [];
  shifts.forEach(shift => {
    if (shift.dateString >= todayStr && shift.requestedStaffIds) {
      shift.requestedStaffIds.forEach(stId => {
        const emp = staff.find(s => s.id === stId);
        if (emp) pendingRequestItems.push({ shift, emp });
      });
    }
  });

  const toggleShiftSelection = (sId: string) => {
    setSelectedShiftIdsForAssign(prev => prev.includes(sId) ? prev.filter(id => id !== sId) : [...prev, sId]);
  };

  const isAdminOrGM = userRole === 'Admin' || userRole === 'General Manager';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black z-40" />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25 }} className="fixed right-0 top-0 bottom-0 w-[420px] max-w-[95vw] bg-white border-l border-slate-200 z-50 p-4 shadow-xl flex flex-col font-sans select-none overflow-hidden">
            <div className="flex-shrink-0 border-b border-slate-200 pb-2 mb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-500" />
                  <div>
                    <h3 className="text-xs font-black text-slate-900">Operations & Payroll</h3>
                    <p className="text-[9px] text-slate-400">Manage employee roster schedules & live payroll cycle</p>
                  </div>
                </div>
                <button onClick={onClose} className="text-[10px] bg-slate-100 p-1 px-2 rounded border hover:bg-slate-200">Close</button>
              </div>

              <div className="bg-slate-100 p-0.5 rounded-lg flex border">
                <button onClick={() => setActiveTab('roster')} className={`flex-1 py-1 text-xs font-bold rounded ${activeTab === 'roster' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}>Staff Directory</button>
                <button onClick={() => setActiveTab('payroll')} className={`flex-1 py-1 text-xs font-bold rounded ${activeTab === 'payroll' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}>Payroll Summary</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
              <AnimatePresence mode="wait">
                {activeTab === 'roster' ? (
                  <motion.div key="roster-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    {isAdminOrGM && pendingRequestItems.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                        <span className="text-[8px] font-bold text-amber-700 uppercase block mb-1">Approval Dashboard ({pendingRequestItems.length})</span>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                          {pendingRequestItems.map(({ shift, emp }) => (
                            <div key={`${shift.id}-${emp.id}`} className="bg-white p-1.5 border border-slate-200 rounded flex justify-between items-center text-[10px]">
                              <div>
                                <span className="font-bold text-slate-800">{emp.name}</span>
                                <span className="text-slate-500 block text-[9px] font-mono">{shift.dateString} · {shift.type}</span>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => onApproveShiftRequest?.(emp.id, shift.id)} className="bg-emerald-500 text-white font-bold text-[8px] px-1.5 py-0.5 rounded">Approve</button>
                                <button onClick={() => onRejectShiftRequest?.(emp.id, shift.id)} className="bg-red-50 text-red-600 border border-red-200 font-bold text-[8px] px-1.5 py-0.5 rounded">Reject</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {isAdminOrGM && staff.filter(s => s.status === 'pending' || s.is_approved === false).length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                        <span className="text-[8px] font-bold text-amber-700 uppercase block mb-1">Pending Staff Registrations ({staff.filter(s => s.status === 'pending' || s.is_approved === false).length})</span>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                          {staff.filter(s => s.status === 'pending' || s.is_approved === false).map(emp => (
                            <div key={emp.id} className="bg-white p-1.5 border border-slate-200 rounded flex justify-between items-center text-[10px]">
                              <div>
                                <span className="font-bold text-slate-800">{emp.name}</span>
                                <span className="text-slate-500 block text-[9px] font-mono">{emp.email || 'No email'}</span>
                              </div>
                              <div className="flex gap-1">
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    onUpdateStaffMember(emp.id, { status: 'active', is_approved: true }); 
                                  }} 
                                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[8px] px-2 py-1 rounded transition cursor-pointer"
                                >
                                  Approve Staff
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleAddStaffSubmit} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Register New Employee</span>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="Full Name *" value={name} onChange={e => setName(e.target.value)} className="bg-white rounded border p-1 text-xs" required />
                        <input type="text" placeholder="Role Title *" value={role} onChange={e => setRole(e.target.value)} className="bg-white rounded border p-1 text-xs" required />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="tel" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} className="bg-white rounded border p-1 text-xs" />
                        <input type="number" step="0.01" placeholder="Wage rate" value={customHourlyRate} onChange={e => setCustomHourlyRate(e.target.value)} disabled={!isAdminOrGM} className="bg-white rounded border p-1 text-xs" />
                      </div>
                      <div className="flex gap-1.5 items-center">
                        {APPLE_COLOR_PALETTE.map(col => (
                          <button key={col.value} type="button" onClick={() => setSelectedColor(col.value)} className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedColor === col.value ? 'scale-110 border-slate-800 shadow-xs' : 'border-transparent'}`} style={{ backgroundColor: col.value }}>{selectedColor === col.value && <Check className="w-3 h-3 text-white" />}</button>
                        ))}
                      </div>
                      <button type="submit" className="w-full bg-amber-400 font-bold text-xs py-1.5 rounded hover:bg-amber-500 cursor-pointer">Register Member</button>
                    </form>

                    <div className="space-y-1.5">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Directory List ({staff.length})</span>
                      <div className="border rounded-lg bg-white overflow-hidden text-[10px]">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-[8px] uppercase text-slate-500 border-b">
                            <tr>
                              <th className="p-2 pl-3">Name</th>
                              <th className="p-2">Role</th>
                              <th className="p-2 text-center">Rate</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {staff.map(emp => {
                              const isPending = emp.status === 'pending' || emp.is_approved === false;
                              return (
                                <tr key={emp.id} onClick={() => setSelectedStaffIdForProfile(emp.id)} className="hover:bg-slate-50 cursor-pointer transition border-b border-slate-100 last:border-b-0">
                                  <td className="p-2 pl-3">
                                    <div className="flex items-center gap-2">
                                      <span className="w-3 h-3 rounded-full border border-black/10 shadow-xs shrink-0 inline-block" style={{ backgroundColor: emp.color }} />
                                      <div className="flex flex-col">
                                        <span className="font-bold text-slate-900 whitespace-normal">{emp.name}</span>
                                        {isPending && (
                                          <span className="text-[7px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 font-bold uppercase w-max mt-0.5">Pending Approval</span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-2 text-slate-500">{emp.role}</td>
                                  <td className="p-2 text-center font-mono">
                                    {isAdminOrGM ? (
                                      <input type="number" step="0.01" value={emp.hourlyRate ?? 10.00} onClick={e => e.stopPropagation()} onChange={e => onUpdateStaffMember(emp.id, { hourlyRate: parseFloat(e.target.value) || 10.00 })} className="bg-white border rounded w-14 text-center font-bold py-0.5 outline-none border-slate-200 focus:border-amber-400" />
                                    ) : (
                                      <span className="text-slate-400 italic">Locked</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="payroll-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    {!isAdminOrGM ? (
                      <div className="p-4 bg-slate-50 rounded-lg text-center border">
                        <Lock className="w-5 h-5 text-red-500 mx-auto mb-1.5" />
                        <h4 className="text-xs font-bold uppercase text-slate-700">Access Restricted</h4>
                        <p className="text-[10px] text-slate-400 mt-1">Wage and accounting metrics are confidential. Use top header role toggles to view.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-amber-50 border p-2.5 rounded-lg flex justify-between items-center">
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-800">Bi-Weekly Gross Wages</h4>
                            <p className="text-[9px] text-slate-500">Double shift capped at £80 daily.</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] text-slate-400 block font-bold uppercase">Cycle Spend</span>
                            <span className="text-xs font-black text-amber-600 font-mono">£{staff.reduce((acc, emp) => acc + (biWeeklyStats[emp.id]?.cappedPay || 0) + (emp.bonusAdjustment ?? 0), 0).toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border space-y-2 text-[10px]">
                          <select value={selectedCycleId} onChange={e => setSelectedCycleId(e.target.value)} className="w-full bg-white border p-1 rounded font-bold text-slate-800">
                            {PREDEFINED_CYCLES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </select>

                          {selectedCycleId === 'custom' && (
                            <div className="p-1.5 border-t border-slate-100 flex items-center justify-between gap-2">
                              <span className="text-[8px] font-bold uppercase text-slate-400">Custom Start:</span>
                              <input type="date" value={customStartDateStr} onChange={e => setCustomStartDateStr(e.target.value)} className="border rounded p-0.5 text-[9px]" />
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                            <div>
                              <span className="text-[8px] text-slate-400 block font-bold">MODE</span>
                              <div className="bg-slate-100 p-0.5 rounded flex border">
                                <button onClick={() => setMorningPayMode('flat')} className={`py-0.5 px-2 text-[9px] rounded font-bold ${morningPayMode === 'flat' ? 'bg-amber-400 text-black' : 'text-slate-500'}`}>£50 Flat</button>
                                <button onClick={() => setMorningPayMode('hourly')} className={`py-0.5 px-2 text-[9px] rounded font-bold ${morningPayMode === 'hourly' ? 'bg-white text-slate-700' : 'text-slate-500'}`}>Hourly</button>
                              </div>
                            </div>
                            <button onClick={handleExportCSV} className="bg-amber-400 font-extrabold text-[9px] py-1 px-2.5 rounded hover:bg-amber-500 transition cursor-pointer flex items-center gap-1 shadow-xs"><FileSpreadsheet className="w-4 h-4" /> Export CSV</button>
                          </div>
                        </div>

                        <div className="border rounded-lg bg-white overflow-hidden text-[10px]">
                          <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[8px] uppercase text-slate-500 border-b">
                              <tr>
                                <th className="p-1.5 pl-2">Employee</th>
                                <th className="p-1.5 text-center">Hours</th>
                                <th className="p-1.5 text-center">Adj</th>
                                <th className="p-1.5 text-right">Pay</th>
                                <th className="p-1.5 text-center">Paid</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {staff.map(emp => {
                                const st = biWeeklyStats[emp.id] || { hours: 0, cappedPay: 0, hasCapApplied: false };
                                const adj = emp.bonusAdjustment ?? 0;
                                const isPaid = !!paidRecords[periodKey]?.[emp.id];

                                return (
                                  <tr key={emp.id} className={isPaid ? 'bg-emerald-50/20 text-slate-400' : ''}>
                                    <td className="p-1.5 pl-2 font-bold">{emp.name}</td>
                                    <td className="p-1.5 text-center font-mono">{st.hours.toFixed(1)}h</td>
                                    <td className="p-1.5 text-center">
                                      <input type="number" step="1" value={adj} onChange={e => onUpdateStaffMember(emp.id, { bonusAdjustment: parseInt(e.target.value) || 0 })} className="bg-white border rounded w-8 text-center text-emerald-600 font-bold" />
                                    </td>
                                    <td className="p-1.5 text-right font-mono font-bold text-amber-600">
                                      £{(st.cappedPay + adj).toFixed(2)}
                                      {st.hasCapApplied && <span className="block text-[6px] text-emerald-600 uppercase font-black">Capped</span>}
                                    </td>
                                    <td className="p-1.5 text-center">
                                      <button onClick={() => togglePaidStatus(emp.id)} className={`px-2 py-0.5 rounded text-[8px] font-bold ${isPaid ? 'bg-emerald-600 text-white' : 'bg-slate-100 border text-slate-600'}`}>{isPaid ? 'Paid' : 'Pay'}</button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Settings Overlay View inside staff directory */}
            <AnimatePresence>
              {selectedStaffForProfile && (
                <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="absolute inset-0 bg-white z-50 p-4 flex flex-col">
                  <div className="flex-shrink-0 border-b pb-2 mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black text-slate-900">{selectedStaffForProfile.name}</h3>
                      <p className="text-[9px] text-slate-400">Settings and active shift roster slots</p>
                    </div>
                    <button onClick={() => { setSelectedStaffIdForProfile(null); setIsConfirmingDelete(false); }} className="text-[10px] bg-slate-100 px-2 py-1 rounded">Back</button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 min-h-0 text-[10px]">
                    {isConfirmingDelete ? (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center space-y-2">
                        <span className="text-[9px] font-bold uppercase text-red-600 block">Confirm Permanent Removal?</span>
                        <p className="text-[10px] text-slate-600">This will delete their user profile and unassign them from all slots.</p>
                        <div className="flex gap-2">
                          <button onClick={() => { onDeleteStaff(selectedStaffForProfile.id); setSelectedStaffIdForProfile(null); setIsConfirmingDelete(false); }} className="bg-red-600 text-white font-bold py-1 px-3 rounded flex-1">Yes, Delete</button>
                          <button onClick={() => setIsConfirmingDelete(false)} className="bg-slate-200 text-slate-700 py-1 px-3 rounded flex-1">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(selectedStaffForProfile.status === 'pending' || selectedStaffForProfile.is_approved === false) && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center space-y-2">
                            <span className="text-[8px] font-bold uppercase text-amber-700 block">Pending Admin Approval</span>
                            <p className="text-[10px] text-slate-600 leading-snug">This employee account is currently pending. They cannot access schedule or payroll features until approved.</p>
                            {isAdminOrGM && (
                              <button 
                                onClick={() => { 
                                  onUpdateStaffMember(selectedStaffForProfile.id, { status: 'active', is_approved: true }); 
                                }} 
                                className="w-full bg-amber-400 hover:bg-amber-500 text-black font-black py-1.5 rounded transition text-[10px] cursor-pointer shadow-xs"
                              >
                                Approve Staff Profile
                              </button>
                            )}
                          </div>
                        )}
                        <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 uppercase block">Name</label>
                              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} disabled={!isAdminOrGM} className="w-full bg-white border p-1 rounded text-[10px]" />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 uppercase block">Role</label>
                              <input type="text" value={editRole} onChange={e => setEditRole(e.target.value)} disabled={!isAdminOrGM} className="w-full bg-white border p-1 rounded text-[10px]" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 uppercase block">Phone</label>
                              <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} disabled={!isAdminOrGM} className="w-full bg-white border p-1 rounded text-[10px]" />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 uppercase block">Wage Rate</label>
                              <input type="number" step="0.01" value={editHourlyRate} onChange={e => setEditHourlyRate(e.target.value)} disabled={!isAdminOrGM} className="w-full bg-white border p-1 rounded text-[10px]" />
                            </div>
                          </div>

                          <div className="pt-1">
                            <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Shift Color Badge</label>
                            <div className="flex gap-1.5 items-center">
                              {APPLE_COLOR_PALETTE.map(col => (
                                <button
                                  key={col.value}
                                  type="button"
                                  onClick={() => { if (isAdminOrGM) setEditColor(col.value); }}
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${editColor === col.value ? 'scale-110 border-slate-800 shadow-xs' : 'border-transparent'}`}
                                  style={{ backgroundColor: col.value }}
                                >
                                  {editColor === col.value && <Check className="w-3 h-3 text-white" />}
                                </button>
                              ))}
                            </div>
                          </div>

                          {isAdminOrGM && (
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={handleSaveProfileChanges}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded transition text-[10px] cursor-pointer"
                              >
                                Save Changes
                              </button>
                              {saveSuccessMsg && (
                                <span className="block text-[9px] text-emerald-600 font-bold mt-1 text-center">
                                  {saveSuccessMsg}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-lg">
                          <span className="text-[8px] font-bold uppercase text-slate-400 block mb-1">Available future Shifts</span>
                          {openShifts.length === 0 ? (
                            <p className="text-[9px] text-slate-400 italic">No open slots starting from today</p>
                          ) : (
                            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                              {openShifts.map(sh => {
                                const isSel = selectedShiftIdsForAssign.includes(sh.id);
                                return (
                                  <button key={sh.id} type="button" onClick={() => toggleShiftSelection(sh.id)} className={`w-full flex justify-between p-1 rounded border text-[9px] text-left ${isSel ? 'bg-amber-100 border-amber-300' : 'bg-white'}`}>
                                    <span>{sh.dateString} · {sh.type} ({sh.startTime}-{sh.endTime})</span>
                                    <span className="text-[8px] font-black uppercase text-amber-700">{isSel ? 'Selected' : 'Select'}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <button onClick={() => { if (isAdminOrGM) { onAssignStaffToShifts(selectedStaffForProfile.id, selectedShiftIdsForAssign); } else { onRequestStaffShifts?.(selectedStaffForProfile.id, selectedShiftIdsForAssign); } setSelectedShiftIdsForAssign([]); }} disabled={selectedShiftIdsForAssign.length === 0} className={`w-full text-xs font-bold py-1 rounded mt-2 cursor-pointer ${selectedShiftIdsForAssign.length > 0 ? 'bg-amber-400 text-black' : 'bg-slate-100 text-slate-400'}`}>
                            {isAdminOrGM ? 'Assign selected' : 'Request selected'}
                          </button>
                        </div>

                        <button onClick={() => setIsConfirmingDelete(true)} className="w-full bg-red-100 text-red-700 border border-red-200 font-bold py-2 rounded">Delete employee profile</button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// --- MAIN App COMPONENT ---
export default function App() {
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('Regular Staff');
  const [currentUserProfile, setCurrentUserProfile] = useState<Staff | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#0A84FF');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [allowPublicSignUp, setAllowPublicSignUp] = useState(true);

  const getSafeInitialDate = () => {
    try {
      const d = new Date();
      if (!isNaN(d.getTime())) return d;
    } catch (e) {
      console.warn("Date error:", e);
    }
    return new Date(2026, 6, 20); // July 20, 2026 fallback
  };

  const getSafeFormattedDate = (date: Date) => {
    try {
      return formatDateString(date);
    } catch {
      return "2026-07-20";
    }
  };

  const today = getSafeInitialDate();
  const [selectedDateStr, setSelectedDateStr] = useState(() => getSafeFormattedDate(today));
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const [currentYear, setCurrentYear] = useState(() => {
    try {
      return today.getFullYear();
    } catch {
      return 2026;
    }
  });
  const [currentMonth, setCurrentMonth] = useState(() => {
    try {
      return today.getMonth();
    } catch {
      return 6; // July
    }
  });
  const [isStaffManagerOpen, setIsStaffManagerOpen] = useState(false);

  // Appended stand-alone PWA meta configurations dynamically
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const metas = [
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
        { name: 'theme-color', content: '#0B2545' }
      ];
      metas.forEach(spec => {
        let el = document.querySelector(`meta[name="${spec.name}"]`);
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute('name', spec.name);
          document.head.appendChild(el);
        }
        el.setAttribute('content', spec.content);
      });
    }
  }, []);

  useEffect(() => {
    fetchFromSupabase();
    if (isSupabaseConfigured) {
      const interval = setInterval(fetchFromSupabase, 8000);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    const unsubStaff = subscribeToStaff(st => setStaff(st));
    const unsubShifts = subscribeToShifts(sh => setShifts(sh));
    const unsubSettings = subscribeToRegistrationSettings((se: any) => setAllowPublicSignUp(se.allowPublicSignUp));
    return () => { unsubStaff(); unsubShifts(); unsubSettings(); };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoadingAuth(false);
      return;
    }
    
    let isMounted = true;

    try {
      supabase.auth.getSession().then((res) => {
        if (!isMounted) return;
        const session = res?.data?.session ?? null;
        const user = session?.user ?? null;
        setCurrentUser(user);
        setIsLoadingAuth(false);
      }).catch((err) => {
        console.error("Error getting session:", err);
        if (isMounted) setIsLoadingAuth(false);
      });
    } catch (err) {
      console.error("Error invoking getSession:", err);
      setIsLoadingAuth(false);
    }

    let subscriptionObj: any = null;
    try {
      const { data } = supabase.auth.onAuthStateChange((_e, session) => {
        if (!isMounted) return;
        const user = session?.user ?? null;
        setCurrentUser(user);
        setIsLoadingAuth(false);
      });
      subscriptionObj = data?.subscription;
    } catch (err) {
      console.error("Error listening to auth state change:", err);
    }

    return () => {
      isMounted = false;
      if (subscriptionObj?.unsubscribe) {
        try {
          subscriptionObj.unsubscribe();
        } catch (unsubErr) {
          console.warn("Error unsubscribing auth listener:", unsubErr);
        }
      }
    };
  }, []);

  useEffect(() => {
    updateUserRoleAndProfile(currentUser);
  }, [currentUser, staff]);

  function updateUserRoleAndProfile(user: SupabaseUser | null) {
    if (user) {
      // Secure email matching to prevent matching empty emails
      let profile = staff.find(s => s && (s.id === user.id || (user.email && s.email && typeof s.email === 'string' && s.email.trim() !== '' && s.email.toLowerCase() === user.email.toLowerCase())));
      const isOwner = user.email?.toLowerCase() === 'termz50@gmail.com' || user.email?.toLowerCase() === 'hermes.fawo@hotmail.co.uk';
      if (profile) {
        // Ensure name is never empty
        let finalName = (profile.name || '').trim();
        if (!finalName) {
          finalName = (user.user_metadata?.full_name || user.user_metadata?.name || (user.email || '').split('@')[0] || 'Staff Member').trim();
          profile.name = finalName;
          updateStaffInFirestore(profile.id, { name: finalName });
        }
        setCurrentUserProfile(profile);
        const r = (profile.role || 'Sales Associate').toString().toLowerCase();
        if (isOwner || r.includes('admin') || r.includes('store manager')) setUserRole('Admin');
        else if (r.includes('lead') || r.includes('gm') || r.includes('general manager')) setUserRole('General Manager');
        else setUserRole('Regular Staff');

        // Ensure email account binding is synchronized
        if (user.email && (!profile.email || typeof profile.email !== 'string' || profile.email.toLowerCase() !== user.email.toLowerCase())) {
          const boundEmail = user.email.toLowerCase();
          profile.email = boundEmail;
          updateStaffInFirestore(profile.id, { email: boundEmail });
        }
      } else {
        const metaName = (user.user_metadata?.full_name || user.user_metadata?.name || (user.email || '').split('@')[0] || 'Staff Member').trim();
        const fallbackColor = user.user_metadata?.color || '#0A84FF';
        const calculatedRole = isOwner ? 'Store Manager' : 'Sales Associate';
        const calculatedStatus = isOwner ? 'active' : 'pending';
        const calculatedApproved = isOwner;

        const tempProfile: Staff = {
          id: user.id,
          name: metaName,
          role: calculatedRole,
          color: fallbackColor,
          phone: 'Unlisted',
          hourlyRate: 10.00,
          bonusAdjustment: 0,
          email: user.email?.toLowerCase() || '',
          status: calculatedStatus,
          is_approved: calculatedApproved
        };

        if (isFirstFetchCompleted) {
          // Create the profile in the database cleanly and persist across views
          addStaffToFirestore(tempProfile);
        }

        setCurrentUserProfile(tempProfile);
        if (isOwner) setUserRole('Admin');
        else setUserRole('Regular Staff');
      }
    } else {
      setCurrentUserProfile(null);
      setUserRole('Regular Staff');
    }
  }

  const handleSelectDate = (dStr: string) => {
    setSelectedDateStr(dStr);
    const parsed = parseDateString(dStr);
    setCurrentYear(parsed.getFullYear());
    setCurrentMonth(parsed.getMonth());
  };

  const handleAddOrUpdateShift = async (s: Shift) => {
    try { await addOrUpdateShiftInFirestore(s); } catch (e) { alert(e); }
  };
  const handleRemoveShift = async (id: string) => {
    try { await deleteShiftFromFirestore(id); } catch (e) { alert(e); }
  };
  const handleAddStaff = async (member: Staff) => {
    try { await addStaffToFirestore(member); } catch (e) { alert(e); }
  };
  const handleUpdateStaffMember = async (id: string, updates: Partial<Staff>) => {
    try { await updateStaffInFirestore(id, updates); } catch (e) { alert(e); }
  };
  const handleDeleteStaff = async (id: string) => {
    try {
      await deleteStaffFromFirestore(id);
      const affected = shifts.filter(s => s.assignedStaffIds.includes(id) || s.requestedStaffIds?.includes(id));
      for (const sh of affected) {
        await addOrUpdateShiftInFirestore({
          ...sh,
          assignedStaffIds: sh.assignedStaffIds.filter(stId => stId !== id),
          requestedStaffIds: (sh.requestedStaffIds || []).filter(stId => stId !== id)
        });
      }
    } catch (e) { alert(e); }
  };

  const handleAssignStaffToShifts = async (stId: string, shIds: string[]) => {
    for (const id of shIds) {
      const sh = shifts.find(s => s.id === id);
      if (sh && !sh.assignedStaffIds.includes(stId)) {
        await addOrUpdateShiftInFirestore({ ...sh, assignedStaffIds: [...sh.assignedStaffIds, stId] });
      }
    }
  };

  const handleRequestStaffShifts = async (stId: string, shIds: string[]) => {
    for (const id of shIds) {
      const sh = shifts.find(s => s.id === id);
      if (sh) {
        const req = sh.requestedStaffIds || [];
        if (!req.includes(stId) && !sh.assignedStaffIds.includes(stId)) {
          await addOrUpdateShiftInFirestore({ ...sh, requestedStaffIds: [...req, stId] });
        }
      }
    }
  };

  const handleApproveShiftRequest = async (stId: string, shId: string) => {
    const sh = shifts.find(s => s.id === shId);
    if (sh) {
      const req = sh.requestedStaffIds || [];
      const updatedAssigned = sh.assignedStaffIds.includes(stId) ? sh.assignedStaffIds : [...sh.assignedStaffIds, stId];
      await addOrUpdateShiftInFirestore({ ...sh, requestedStaffIds: req.filter(id => id !== stId), assignedStaffIds: updatedAssigned });
    }
  };

  const handleRejectShiftRequest = async (stId: string, shId: string) => {
    const sh = shifts.find(s => s.id === shId);
    if (sh) {
      const req = sh.requestedStaffIds || [];
      await addOrUpdateShiftInFirestore({ ...sh, requestedStaffIds: req.filter(id => id !== stId) });
    }
  };

  const handleTogglePublicRegistration = async () => {
    try { await updateRegistrationSettingsInFirestore(!allowPublicSignUp); } catch (e) { alert(e); }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(''); setAuthSuccess(''); setIsSubmitting(true);

    try {
      if (authTab === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuthSuccess('Logged in successfully!');
      } else {
        if (password !== confirmPassword) { setAuthError('Passwords do not match'); setIsSubmitting(false); return; }
        const isOwner = email.toLowerCase() === 'termz50@gmail.com' || email.toLowerCase() === 'hermes.fawo@hotmail.co.uk';
        if (!allowPublicSignUp && !isOwner) { setAuthError('Public sign-up is locked.'); setIsSubmitting(false); return; }
        if (!fullName) { setAuthError('Enter full name'); setIsSubmitting(false); return; }

        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, color: selectedColor } } });
        if (error) throw error;
        const uId = data?.user?.id;
        if (!uId) throw new Error('Registration failed');

        const initialStatus = isOwner ? 'active' : 'pending';
        const initialApproved = isOwner;

        const newStaff: Staff = { 
          id: uId, 
          name: fullName, 
          role: 'Sales Associate', 
          color: selectedColor, 
          phone: 'Unlisted', 
          hourlyRate: 10.00, 
          bonusAdjustment: 0, 
          email: email.toLowerCase(),
          status: initialStatus,
          is_approved: initialApproved
        };

        await safeUpsert('profiles', { 
          id: uId, 
          name: fullName, 
          role: 'Sales Associate', 
          color: selectedColor, 
          phone: 'Unlisted', 
          hourly_rate: 10.00, 
          hourlyRate: 10.00, 
          bonus_adjustment: 0, 
          bonusAdjustment: 0, 
          email: email.toLowerCase(),
          status: initialStatus,
          is_approved: initialApproved
        });

        await addStaffToFirestore(newStaff);
        setAuthSuccess('Account registered successfully!');
      }
    } catch (err: any) {
      setAuthError(err.message || 'An authentication error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try { if (isSupabaseConfigured) await supabase.auth.signOut(); } catch {}
  };

  const activeDayConfig = getDayShiftConfig(parseDateString(selectedDateStr).getDay());

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#0B2545]/20 border-t-[#0B2545] rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-500">Syncing database rota files...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-[#0B2545] p-5 text-center relative">
            <h1 className="text-base font-black text-white tracking-tight">Rota Staff Gate</h1>
            <p className="text-[10px] text-slate-300 mt-0.5">Authorised Scheduling & Payroll Access</p>
            <div className="mt-4 bg-white/10 p-1 rounded-lg flex border border-white/10">
              <button type="button" onClick={() => { setAuthTab('signin'); setAuthError(''); setAuthSuccess(''); setShowPassword(false); setShowConfirmPassword(false); }} className={`flex-1 py-1 text-xs font-bold rounded ${authTab === 'signin' ? 'bg-white text-[#0B2545]' : 'text-white'}`}>Sign In</button>
              <button type="button" onClick={() => { setAuthTab('signup'); setAuthError(''); setAuthSuccess(''); setShowPassword(false); setShowConfirmPassword(false); }} className={`flex-1 py-1 text-xs font-bold rounded ${authTab === 'signup' ? 'bg-white text-[#0B2545]' : 'text-white'}`}>Sign Up</button>
            </div>
          </div>

          <form onSubmit={handleAuthSubmit} className="p-5 space-y-3">
            {authTab === 'signup' && (
              <>
                <div className="space-y-0.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase">Full Name</label>
                  <input type="text" required placeholder="Liam Thompson" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase">Shift visual badge color</label>
                  <div className="flex items-center gap-1.5">
                    {APPLE_COLOR_PALETTE.map(col => (
                      <button type="button" key={col.value} onClick={() => setSelectedColor(col.value)} className={`w-5.5 h-5.5 rounded-full border flex items-center justify-center ${selectedColor === col.value ? 'scale-110 border-slate-800' : 'border-slate-200'}`} style={{ backgroundColor: col.value }}>{selectedColor === col.value && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-0.5">
              <label className="text-[9px] font-bold text-slate-500 uppercase">Email</label>
              <input type="email" required placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none" />
            </div>

            <div className="space-y-0.5">
              <label className="text-[9px] font-bold text-slate-500 uppercase">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  required 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {authTab === 'signup' && (
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase">Confirm Password</label>
                <div className="relative">
                  <input 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    required 
                    placeholder="••••••••" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {authTab === 'signup' && !allowPublicSignUp && email.toLowerCase() !== 'termz50@gmail.com' && email.toLowerCase() !== 'hermes.fawo@hotmail.co.uk' && (
              <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[10px] font-medium flex gap-1"><AlertTriangle className="w-4 h-4 shrink-0" /> Public signup is locked.</div>
            )}

            {authError && <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-[10px]">{authError}</div>}
            {authSuccess && <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-[10px]">{authSuccess}</div>}

            <button type="submit" disabled={isSubmitting} className="w-full py-2.5 bg-[#0B2545] text-white rounded-lg text-xs font-black hover:bg-[#134074] transition flex items-center justify-center gap-1.5 cursor-pointer">{isSubmitting ? 'Verifying...' : authTab === 'signin' ? 'Sign In' : 'Register Account'} <ArrowRight className="w-3.5 h-3.5" /></button>
          </form>
        </div>
      </div>
    );
  }

  const isOwner = currentUser?.email?.toLowerCase() === 'termz50@gmail.com' || currentUser?.email?.toLowerCase() === 'hermes.fawo@hotmail.co.uk';

  if (currentUser && !isOwner && (currentUserProfile?.status === 'pending' || currentUserProfile?.is_approved === false)) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500 border border-amber-200 animate-pulse">
            <Clock className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight">Registration Received</h1>
            <p className="text-xs text-slate-500 font-bold leading-snug">
              Account Pending Admin Approval.<br />Please wait for Hermes to approve your registration.
            </p>
          </div>
          <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-lg text-left text-[10px] text-amber-800 font-medium">
            Your name is registered as: <strong className="font-extrabold text-slate-900">{currentUserProfile?.name}</strong><br />
            Email: <strong className="font-extrabold text-slate-900">{currentUser?.email}</strong>
          </div>
          <button 
            onClick={handleSignOut}
            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-slate-50 font-sans">
      <header className="h-11 px-4 bg-[#0B2545] border-b border-blue-900/40 flex items-center justify-between select-none flex-shrink-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-red-500 flex flex-col items-center justify-center text-white scale-90">
            <span className="text-[6px] font-black tracking-widest leading-none">ROTA</span>
            <span className="text-[9px] font-extrabold leading-none mt-0.5">20</span>
          </div>
          <div>
            <h1 className="text-[11px] font-extrabold text-white leading-none">Employee Rota Organizer</h1>
            <p className="text-[8px] text-slate-300 font-medium">Responsive Scheduling & Payroll Tracker</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1.5 bg-[#134074]/30 border border-[#134074]/50 px-2 py-0.5 rounded">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="text-[9px] text-slate-200">
            {activeDayConfig.isOpen ? <span>Operating: <strong className="text-amber-400">{activeDayConfig.morning.start} - 19:00</strong></span> : <span className="text-red-400 font-bold uppercase">Closed</span>}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {userRole === 'Admin' && (
            <button onClick={handleTogglePublicRegistration} className="flex items-center gap-1 bg-[#134074]/30 border border-[#134074]/50 px-2 py-1 rounded text-slate-200 hover:text-white text-[9px] cursor-pointer">
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span>{allowPublicSignUp ? '🔓 Signups On' : '🔒 Signups Off'}</span>
            </button>
          )}

          <div className="flex items-center gap-1 bg-[#134074]/30 border border-[#134074]/50 px-2 py-1 rounded select-none">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentUserProfile?.color || '#FFD700' }} />
            <div className="text-left leading-none">
              <span className="text-[9px] font-bold text-amber-400 block truncate max-w-[70px]">
                {currentUserProfile?.name || currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || currentUser?.email?.split('@')[0] || 'Staff'}
              </span>
              <span className="text-[7px] text-slate-300 block font-mono mt-0.5 uppercase">{userRole === 'Admin' ? '🔑 Admin' : userRole === 'General Manager' ? '💼 GM' : '👥 Staff'}</span>
            </div>
          </div>

          <button onClick={() => setIsStaffManagerOpen(true)} className="flex items-center gap-1 text-[9px] font-black bg-amber-400 hover:bg-amber-500 text-black py-1 px-2.5 rounded shadow-sm transition cursor-pointer">
            <Users className="w-3.5 h-3.5" />
            <span>Roster ({staff.length})</span>
          </button>

          <button onClick={handleSignOut} className="p-1 bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600 hover:text-white rounded transition cursor-pointer">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col landscape:flex-row md:flex-row min-h-0 select-none overflow-y-auto landscape:overflow-hidden md:overflow-hidden relative bg-white">
        <section className="w-full landscape:w-[52%] md:w-[52%] h-auto landscape:h-full md:h-full flex flex-col overflow-visible landscape:overflow-hidden md:overflow-hidden bg-white shrink-0">
          <CalendarSection selectedDateStr={selectedDateStr} onSelectDate={handleSelectDate} shifts={shifts} staff={staff} viewMode={viewMode} setViewMode={setViewMode} currentYear={currentYear} currentMonth={currentMonth} setCurrentYear={setCurrentYear} setCurrentMonth={setCurrentMonth} />
        </section>

        <section className="w-full landscape:w-[48%] md:w-[48%] h-auto landscape:h-full md:h-full flex flex-col bg-white overflow-visible landscape:overflow-hidden md:overflow-hidden relative border-t landscape:border-t-0 landscape:border-l md:border-t-0 md:border-l border-slate-200 shrink-0">
          <ShiftDetailsController selectedDateStr={selectedDateStr} shifts={shifts} staff={staff} onAddOrUpdateShift={handleAddOrUpdateShift} onRemoveShift={handleRemoveShift} userRole={userRole} />
        </section>
      </main>

      <StaffManager staff={staff} onAddStaff={handleAddStaff} onUpdateStaffMember={handleUpdateStaffMember} onDeleteStaff={handleDeleteStaff} onAssignStaffToShifts={handleAssignStaffToShifts} onRequestStaffShifts={handleRequestStaffShifts} onApproveShiftRequest={handleApproveShiftRequest} onRejectShiftRequest={handleRejectShiftRequest} isOpen={isStaffManagerOpen} onClose={() => setIsStaffManagerOpen(false)} shifts={shifts} userRole={userRole} />
    </div>
  );
}
