/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Staff {
  id: string;
  name: string;
  role: string;
  color: string; // iOS-style system colors for highlighting shifts
  avatarUrl?: string;
  phone?: string;
  hourlyRate?: number; // Hourly pay rate, defaults to £10.00
  bonusAdjustment?: number; // Manual payment adjustment / bonus, defaults to 0
}

export type UserRole = 'Admin' | 'General Manager' | 'Regular Staff';

export type ShiftType = 'Morning' | 'Afternoon';

export interface Shift {
  id: string;
  dateString: string; // YYYY-MM-DD
  type: ShiftType;
  startTime: string; // e.g. "09:30"
  endTime: string; // e.g. "14:30"
  assignedStaffIds: string[]; // up to 2 staff members
  notes?: string;
  requestedStaffIds?: string[]; // Staff IDs who have requested this shift and are pending approval
}

export interface DayShiftConfig {
  morning: { start: string; end: string };
  afternoon: { start: string; end: string };
  isOpen: boolean;
}

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Date.getDay()
