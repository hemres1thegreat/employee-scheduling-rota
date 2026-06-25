/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CalendarDays } from 'lucide-react';
import { Shift, Staff } from '../types';
import {
  formatDateString,
  generateMonthData,
  getDayShiftConfig,
  parseDateString,
  MAX_ROSTER_SIZE,
} from '../utils/rotaUtils';

interface CalendarSectionProps {
  selectedDateStr: string;
  onSelectDate: (dateStr: string) => void;
  shifts: Shift[];
  staff: Staff[];
  viewMode: 'month' | 'week';
  setViewMode: (mode: 'month' | 'week') => void;
  currentYear: number;
  currentMonth: number;
  setCurrentYear: (year: number) => void;
  setCurrentMonth: (month: number) => void;
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function CalendarSection({
  selectedDateStr,
  onSelectDate,
  shifts,
  staff,
  viewMode,
  setViewMode,
  currentYear,
  currentMonth,
  setCurrentYear,
  setCurrentMonth,
}: CalendarSectionProps) {
  
  // Handlers for month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Generate Month Matrix
  const daysInMonthMatrix = generateMonthData(currentYear, currentMonth);

  // Group shifts by date for rapid lookup
  const getShiftsForDate = (dateStr: string) => {
    return shifts.filter((s) => s.dateString === dateStr);
  };

  // Generate current week dates based on selected date
  const getWeekDaysAroundSelected = (): Date[] => {
    const selected = parseDateString(selectedDateStr);
    const dayOfWeek = selected.getDay();
    const result: Date[] = [];
    
    // Start of week (Sunday)
    const sunday = new Date(selected);
    sunday.setDate(selected.getDate() - dayOfWeek);

    for (let i = 0; i < 7; i++) {
      const day = new Date(sunday);
      day.setDate(sunday.getDate() + i);
      result.push(day);
    }
    return result;
  };

  const currentWeekDays = getWeekDaysAroundSelected();

  return (
    <div className="flex flex-col h-full bg-neutral-950 border-r border-neutral-800/80 min-w-0">
      
      {/* Calendar Header Control Toolbar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-neutral-900 bg-neutral-950/80 z-10 flex-shrink-0">
        
        {/* Toggle Segment */}
        <div className="bg-neutral-900 p-0.5 rounded-lg flex items-center border border-neutral-800/60 shadow-sm">
          <button
            onClick={() => setViewMode('month')}
            id="view-mode-month"
            className={`flex items-center gap-1 text-[10px] sm:text-xs px-2.5 py-1 rounded-md transition-all duration-150 font-medium ${
              viewMode === 'month'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <CalendarIcon className="w-3 h-3 text-blue-400" />
            <span>Month</span>
          </button>
          <button
            onClick={() => setViewMode('week')}
            id="view-mode-week"
            className={`flex items-center gap-1 text-[10px] sm:text-xs px-2.5 py-1 rounded-md transition-all duration-150 font-medium ${
              viewMode === 'week'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <CalendarDays className="w-3 h-3 text-emerald-400" />
            <span>Week</span>
          </button>
        </div>

        {/* Month Picker / Navigator */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrevMonth}
            id="prev-month-btn"
            className="p-1 rounded-md bg-neutral-900 border border-neutral-800/60 hover:bg-neutral-800 transition active:scale-95 text-neutral-400 hover:text-white"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs sm:text-sm font-semibold tracking-tight text-neutral-100 min-w-[105px] text-center font-sans">
            {MONTHS[currentMonth]} {currentYear}
          </span>
          <button
            onClick={handleNextMonth}
            id="next-month-btn"
            className="p-1 rounded-md bg-neutral-900 border border-neutral-800/60 hover:bg-neutral-800 transition active:scale-95 text-neutral-400 hover:text-white"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Grid/Weekly content - flex scrollable to prevent overflow */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 min-h-0 select-none custom-scrollbar">
        <AnimatePresence mode="wait">
          {viewMode === 'month' ? (
            <motion.div
              key="month-view-grid"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col h-full"
            >
              {/* Day names headers */}
              <div className="grid grid-cols-7 text-center mb-1 text-[10px] font-bold text-neutral-500 font-mono tracking-wider uppercase">
                {DAYS_SHORT.map((d, index) => (
                  <div key={d} className={index === 0 ? 'text-red-500/80 font-semibold' : ''}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Month Numbers Grid */}
              <div className="grid grid-cols-7 gap-0.5 flex-1 min-h-0">
                {daysInMonthMatrix.map((date, index) => {
                  const dateStr = formatDateString(date);
                  const isSelected = dateStr === selectedDateStr;
                  const isCurrentMonth = date.getMonth() === currentMonth;
                  const isSunday = date.getDay() === 0;
                  const dateShifts = getShiftsForDate(dateStr);
                  
                  // Check today
                  const dObj = new Date();
                  const isToday = formatDateString(dObj) === dateStr;

                  return (
                    <button
                      key={`${dateStr}-${index}`}
                      onClick={() => onSelectDate(dateStr)}
                      id={`calendar-cell-${dateStr}`}
                      disabled={false} // Allow selecting any date, including Sundays
                      className={`relative min-h-[46px] group p-1 flex flex-col justify-between text-left rounded-lg transition-all duration-150 border outline-none ${
                        isSelected
                          ? 'bg-blue-600/10 border-blue-500/80 ring-1 ring-blue-500/40 text-white'
                          : isToday
                          ? 'bg-neutral-900 border-neutral-700/80 text-white font-medium shadow-sm'
                          : 'bg-neutral-900/40 border-neutral-900 hover:border-neutral-800 text-neutral-300'
                      } ${!isCurrentMonth ? 'opacity-30' : ''}`}
                    >
                      {/* Date Header: number + Sunday check */}
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-xs font-semibold rounded-full flex items-center justify-center w-5 h-5 leading-none ${
                            isSelected && !isSunday
                              ? 'bg-blue-500 text-white font-black'
                              : isToday
                              ? 'bg-red-500 text-white font-bold'
                              : isSunday
                              ? 'text-red-500 font-bold'
                              : 'text-neutral-300'
                          }`}
                        >
                          {date.getDate()}
                        </span>
                        
                        {isSunday && (
                          <span className="text-[8px] font-sans font-extrabold text-red-500/70 tracking-tighter uppercase mr-0.5">
                            Closed
                          </span>
                        )}
                      </div>

                      {/* Display staff indicators at the bottom */}
                      <div className="mt-1 flex flex-wrap gap-0.5 w-full min-h-[14px]">
                        {!isSunday ? (
                          dateShifts.flatMap((s) => s.assignedStaffIds).slice(0, 4).map((staffId, sIdx) => {
                            const emp = staff.find((st) => st.id === staffId);
                            if (!emp) return null;
                            const initials = emp.name.split(' ').map((n) => n[0]).join('');
                            return (
                              <span
                                key={`${staffId}-${sIdx}`}
                                className="text-[8px] font-black leading-none px-1 py-0.5 rounded flex items-center justify-center font-mono shrink-0 select-none shadow-[0_1px_2px_rgba(0,0,0,0.5)] border border-neutral-950/20"
                                style={{
                                  backgroundColor: emp.color,
                                  color: '#000000',
                                }}
                                title={`${emp.name} (${emp.role})`}
                              >
                                {initials}
                              </span>
                            );
                          })
                        ) : (
                          // Sunday hatched closed bar indicator
                          <div className="w-full h-1 bg-neutral-900 overflow-hidden relative opacity-10">
                            <div className="absolute inset-0 bg-repeating-linear border-t border-neutral-700"></div>
                          </div>
                        )}

                        {/* Unfilled shifts indicator */}
                        {!isSunday && dateShifts.length > 0 && dateShifts.some(sh => sh.assignedStaffIds.length === 0) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse my-auto ml-0.5" title="Unassigned Shifts Present!"></span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            // Weekly cards layout
            <motion.div
              key="week-view"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-2.5 h-full"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentWeekDays.map((date) => {
                  const dateStr = formatDateString(date);
                  const isSelected = dateStr === selectedDateStr;
                  const isSunday = date.getDay() === 0;
                  const dayName = DAYS_SHORT[date.getDay()];
                  const dShifts = getShiftsForDate(dateStr);
                  const isToday = formatDateString(new Date()) === dateStr;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => onSelectDate(dateStr)}
                      id={`week-cell-${dateStr}`}
                      className={`text-left p-3 rounded-xl border transition-all duration-200 outline-none flex flex-col justify-between ${
                        isSelected
                          ? 'bg-neutral-900 border-blue-500 shadow-lg shadow-blue-500/5'
                          : isToday
                          ? 'bg-neutral-900/90 border-red-500/80 shadow-md'
                          : 'bg-neutral-900/40 border-neutral-800/80 hover:bg-neutral-900/60'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full pb-1.5 border-b border-neutral-900">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-extrabold ${isSunday ? 'text-red-500' : 'text-neutral-100'}`}>
                            {dayName}
                          </span>
                          <span className="text-xs text-neutral-400">
                            {date.getDate()} {MONTHS[date.getMonth()].slice(0, 3)}
                          </span>
                        </div>
                        {isToday && (
                          <span className="bg-red-500/10 text-red-400 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md border border-red-500/20 tracking-wider">
                            Today
                          </span>
                        )}
                        {isSunday && (
                          <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 uppercase">
                            Closed
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 space-y-1.5 w-full">
                        {isSunday ? (
                          <p className="text-xs text-neutral-500 italic py-1">Business Closed. Resets on Monday.</p>
                        ) : dShifts.length === 0 ? (
                          <p className="text-xs text-neutral-500 italic py-1">No shifts scheduled</p>
                        ) : (
                          dShifts.map((s) => (
                            <div
                              key={s.id}
                              className="bg-neutral-950/80 px-2 py-1.5 rounded-lg border border-neutral-800/60 flex items-center justify-between"
                            >
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">
                                  {s.type}
                                </span>
                                <span className="text-[9px] text-neutral-500 font-mono">
                                  {s.startTime} - {s.endTime}
                                </span>
                              </div>
                              <div className="flex gap-1">
                                {s.assignedStaffIds.length === 0 ? (
                                  <span className="text-[9px] font-semibold text-orange-400 bg-orange-400/5 border border-orange-500/20 px-1.5 py-0.5 rounded italic animate-pulse">
                                    Unassigned
                                  </span>
                                ) : (
                                  s.assignedStaffIds.map((stId) => {
                                    const st = staff.find((e) => e.id === stId);
                                    if (!st) return null;
                                    return (
                                      <span
                                        key={stId}
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm"
                                        style={{ backgroundColor: st.color, color: '#000000' }}
                                      >
                                        {st.name.split(' ')[0]}
                                      </span>
                                    );
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Embedded Quick Tips footer to help desktop/landscape user */}
      <div className="p-2 border-t border-neutral-900 bg-neutral-950 text-[10px] text-neutral-500 font-sans tracking-wide flex items-center justify-between select-none">
        <span>● Active Roster: {staff.length}/{MAX_ROSTER_SIZE} staff</span>
        <span>Tap a day to manage its shifts</span>
      </div>
    </div>
  );
}
