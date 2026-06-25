/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DayShiftConfig, Shift, Staff } from '../types';

export const DEFAULT_HOURLY_RATE = 10.0;
export const FULL_DAY_FLAT_RATE = 80.0;
export const MAX_ROSTER_SIZE = 10;

export interface PayrollStats {
  hours: number;
  rawPay: number;
  cappedPay: number;
  shiftsCount: number;
  hasCapApplied: boolean;
  morningCount: number;
  afternoonCount: number;
  doubleCount: number;
}

export interface PayrollOptions {
  rangeStart?: string;
  rangeEnd?: string;
}

// The team currently consists of 4 people.
export const INITIAL_STAFF: Staff[] = [
  { id: '1', name: 'Sarah Chen', role: 'Store Manager', color: '#0A84FF', phone: '555-0199', hourlyRate: 10.00 }, // iOS System Blue
  { id: '2', name: 'Marcus Johnson', role: 'Shift Lead', color: '#30D158', phone: '555-0142', hourlyRate: 10.00 }, // iOS System Green
  { id: '3', name: 'Elena Rostova', role: 'Sales Associate', color: '#FF9F0A', phone: '555-0177', hourlyRate: 10.00 }, // iOS System Orange
  { id: '4', name: 'David Kim', role: 'Customer Success', color: '#BF5AF2', phone: '555-0158', hourlyRate: 10.00 }, // iOS System Purple
];

/**
 * Get shift times and opening status for a given day of the week
 * Sunday is 0, Monday is 1, ..., Saturday is 6
 */
export function getDayShiftConfig(dayOfWeek: number): DayShiftConfig {
  if (dayOfWeek === 0) {
    // Sunday - Closed
    return {
      morning: { start: '', end: '' },
      afternoon: { start: '', end: '' },
      isOpen: false,
    };
  }

  if (dayOfWeek >= 1 && dayOfWeek <= 4) {
    // Mon-Thu
    return {
      morning: { start: '09:30', end: '14:30' },
      afternoon: { start: '14:30', end: '19:00' },
      isOpen: true,
    };
  }

  // Fri-Sat (5 and 6)
  return {
    morning: { start: '10:30', end: '14:30' },
    afternoon: { start: '14:30', end: '19:00' },
    isOpen: true,
  };
}

/**
 * Format a Date object to YYYY-MM-DD
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string back to a Date object at matching midnight local timezone
 */
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Generate dates for a calendar monthly view matrix (42 cells: 6 weeks * 7 days)
 * Centered or leading in from the previous month to start on Sunday or Monday
 */
export function generateMonthData(year: number, month: number): Date[] {
  const result: Date[] = [];
  // First day of target month
  const firstDay = new Date(year, month, 1);
  // Learn day of week of the first day (0 = Sunday, 1 = Monday ...)
  const startDayOfWeek = firstDay.getDay();
  
  // Start from Sunday preceding the first day of month (or the day itself if Sunday)
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDayOfWeek);

  for (let i = 0; i < 42; i++) {
    result.push(new Date(startDate));
    startDate.setDate(startDate.getDate() + 1);
  }
  return result;
}

/**
 * Generate preset shifts around June 2026 to populate the app
 */
export function generateInitialShifts(): Shift[] {
  const shifts: Shift[] = [];
  const startDay = new Date(2026, 5, 15); // June 15, 2026 (Monday)

  // We assign some shifts for 2 weeks from June 15 to June 28, 2026
  for (let i = 0; i < 14; i++) {
    const rDate = new Date(startDay);
    rDate.setDate(startDay.getDate() + i);
    
    const dayOfWeek = rDate.getDay();
    const config = getDayShiftConfig(dayOfWeek);
    
    if (!config.isOpen) continue; // Skip Sunday

    const dateStr = formatDateString(rDate);

    // Some simple assignments
    if (i % 2 === 0) {
      // Morning shift: 1 staff (Sarah)
      shifts.push({
        id: `s-${dateStr}-M`,
        dateString: dateStr,
        type: 'Morning',
        startTime: config.morning.start,
        endTime: config.morning.end,
        assignedStaffIds: ['1'],
        notes: 'Opening duties & inventory prep',
      });
      // Afternoon shift: 2 staff (Marcus + David)
      shifts.push({
        id: `s-${dateStr}-A`,
        dateString: dateStr,
        type: 'Afternoon',
        startTime: config.afternoon.start,
        endTime: config.afternoon.end,
        assignedStaffIds: ['2', '4'],
        notes: 'Closing cashier reconciliation & peak hours coverage',
      });
    } else {
      // Morning shift: 2 staff (Marcus + Elena)
      shifts.push({
        id: `s-${dateStr}-M`,
        dateString: dateStr,
        type: 'Morning',
        startTime: config.morning.start,
        endTime: config.morning.end,
        assignedStaffIds: ['2', '3'],
        notes: 'Staff training session',
      });
      // Afternoon: 1 staff (Elena)
      shifts.push({
        id: `s-${dateStr}-A`,
        dateString: dateStr,
        type: 'Afternoon',
        startTime: config.afternoon.start,
        endTime: config.afternoon.end,
        assignedStaffIds: ['3'],
        notes: 'Store reset',
      });
    }
  }

  return shifts;
}

/**
 * Calculates shift duration in decimal hours (e.g., "09:30" to "14:30" is 5.0 hours)
 */
export function calculateShiftHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return 0;
  
  const startDecimal = startH + startM / 60;
  const endDecimal = endH + endM / 60;
  
  let diff = endDecimal - startDecimal;
  if (diff < 0) {
    diff += 24; // Cross midnight handler
  }
  return diff;
}

function createEmptyPayrollStats(): PayrollStats {
  return {
    hours: 0,
    rawPay: 0,
    cappedPay: 0,
    shiftsCount: 0,
    hasCapApplied: false,
    morningCount: 0,
    afternoonCount: 0,
    doubleCount: 0,
  };
}

/**
 * Calculates payroll stats using £10.00/hour default and a flat £80.00 daily
 * rate when an employee works both morning and afternoon shifts on the same day.
 */
export function calculateStaffPayroll(
  shifts: Shift[],
  staffList: Staff[],
  options?: PayrollOptions
): Record<string, PayrollStats> {
  const stats: Record<string, PayrollStats> = {};

  staffList.forEach((member) => {
    stats[member.id] = createEmptyPayrollStats();
  });

  const filteredShifts = shifts.filter((shift) => {
    if (options?.rangeStart && shift.dateString < options.rangeStart) return false;
    if (options?.rangeEnd && shift.dateString > options.rangeEnd) return false;
    return true;
  });

  const shiftsByDate: Record<string, Shift[]> = {};
  filteredShifts.forEach((shift) => {
    if (!shiftsByDate[shift.dateString]) {
      shiftsByDate[shift.dateString] = [];
    }
    shiftsByDate[shift.dateString].push(shift);
  });

  staffList.forEach((member) => {
    const rate = member.hourlyRate ?? DEFAULT_HOURLY_RATE;

    Object.values(shiftsByDate).forEach((dayShifts) => {
      const empShifts = dayShifts.filter((shift) => shift.assignedStaffIds.includes(member.id));
      if (empShifts.length === 0) return;

      const hasMorning = empShifts.some((shift) => shift.type === 'Morning');
      const hasAfternoon = empShifts.some((shift) => shift.type === 'Afternoon');

      let dayHours = 0;
      let dayRawPay = 0;
      let dayPay = 0;

      empShifts.forEach((shift) => {
        const hours = calculateShiftHours(shift.startTime, shift.endTime);
        dayHours += hours;
        dayRawPay += hours * rate;
      });

      if (hasMorning && hasAfternoon) {
        dayPay = FULL_DAY_FLAT_RATE;
        stats[member.id].doubleCount += 1;
        stats[member.id].hasCapApplied = true;
      } else if (hasMorning) {
        const morningShift = empShifts.find((shift) => shift.type === 'Morning')!;
        dayHours = calculateShiftHours(morningShift.startTime, morningShift.endTime);
        dayPay = dayHours * rate;
        stats[member.id].morningCount += 1;
      } else if (hasAfternoon) {
        const afternoonShift = empShifts.find((shift) => shift.type === 'Afternoon')!;
        dayHours = calculateShiftHours(afternoonShift.startTime, afternoonShift.endTime);
        dayPay = dayHours * rate;
        stats[member.id].afternoonCount += 1;
      }

      stats[member.id].hours += dayHours;
      stats[member.id].rawPay += dayRawPay;
      stats[member.id].cappedPay += dayPay;
      stats[member.id].shiftsCount += empShifts.length;
    });
  });

  return stats;
}

