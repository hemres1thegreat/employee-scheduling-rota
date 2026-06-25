/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Calendar, Users, Clock, AlertTriangle, Sparkles, PlusCircle } from 'lucide-react';
import IPhoneShell from './components/IPhoneShell';
import CalendarSection from './components/CalendarSection';
import ShiftDetailsController from './components/ShiftDetailsController';
import StaffManager from './components/StaffManager';
import { Staff, Shift, UserRole } from './types';
import {
  generateInitialShifts,
  INITIAL_STAFF,
  formatDateString,
  parseDateString,
  getDayShiftConfig,
  MAX_ROSTER_SIZE,
} from './utils/rotaUtils';

export default function App() {
  // Initialize States from localStorage or default configurations
  const [staff, setStaff] = useState<Staff[]>(() => {
    const cached = localStorage.getItem('rota_staff');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Error parsing staff cache:', e);
      }
    }
    return INITIAL_STAFF;
  });

  const [shifts, setShifts] = useState<Shift[]>(() => {
    const cached = localStorage.getItem('rota_shifts');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Error parsing shifts cache:', e);
      }
    }
    return generateInitialShifts();
  });

  // Selected date defaults to June 20, 2026 (first seed Saturday)
  const [selectedDateStr, setSelectedDateStr] = useState('2026-06-20');
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  // Month navigation years/month states
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(5); // June is 5 in JS Date Object

  // Roster section open toggles
  const [isStaffManagerOpen, setIsStaffManagerOpen] = useState(false);

  // Active Simulated User Role for security controls
  const [userRole, setUserRole] = useState<UserRole>('Admin');

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('rota_staff', JSON.stringify(staff));
  }, [staff]);

  useEffect(() => {
    localStorage.setItem('rota_shifts', JSON.stringify(shifts));
  }, [shifts]);

  // Adjust month navigation if selected date changes radically (keep monthly grid aligned)
  const handleSelectDate = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    const parsed = parseDateString(dateStr);
    setCurrentYear(parsed.getFullYear());
    setCurrentMonth(parsed.getMonth());
  };

  // Add, Edit, or Modify Shifts
  const handleAddOrUpdateShift = (updatedShift: Shift) => {
    setShifts((prevShifts) => {
      const idx = prevShifts.findIndex((s) => s.id === updatedShift.id);
      if (idx > -1) {
        // Edit existing shift
        const next = [...prevShifts];
        next[idx] = updatedShift;
        return next;
      } else {
        // Add new custom shift
        return [...prevShifts, updatedShift];
      }
    });
  };

  // Delete/Remove Shift
  const handleRemoveShift = (shiftId: string) => {
    setShifts((prevShifts) => prevShifts.filter((s) => s.id !== shiftId));
  };

  // Add new staff member to roster
  const handleAddStaff = (newStaff: Staff) => {
    setStaff((prevStaff) => {
      if (prevStaff.length >= MAX_ROSTER_SIZE) {
        return prevStaff;
      }
      return [...prevStaff, newStaff];
    });
  };

  // Update staff member properties (Hourly rate or manual adjustment)
  const handleUpdateStaffMember = (staffId: string, updates: Partial<Staff>) => {
    setStaff((prevStaff) =>
      prevStaff.map((s) => (s.id === staffId ? { ...s, ...updates } : s))
    );
  };

  // Delete staff member and clean up references
  const handleDeleteStaff = (staffId: string) => {
    setStaff((prevStaff) => prevStaff.filter((s) => s.id !== staffId));
    setShifts((prevShifts) =>
      prevShifts.map((shift) => ({
        ...shift,
        assignedStaffIds: shift.assignedStaffIds.filter((id) => id !== staffId),
      }))
    );
  };

  // Bulk assign a staff member to selected shifts
  const handleAssignStaffToShifts = (staffId: string, shiftIds: string[]) => {
    setShifts((prevShifts) =>
      prevShifts.map((shift) => {
        if (shiftIds.includes(shift.id)) {
          if (!shift.assignedStaffIds.includes(staffId)) {
            return {
              ...shift,
              assignedStaffIds: [...shift.assignedStaffIds, staffId],
            };
          }
        }
        return shift;
      })
    );
  };

  // Bulk request shifts for a staff member (Regular Staff flow)
  const handleRequestStaffShifts = (staffId: string, shiftIds: string[]) => {
    setShifts((prevShifts) =>
      prevShifts.map((shift) => {
        if (shiftIds.includes(shift.id)) {
          const requested = shift.requestedStaffIds || [];
          if (!requested.includes(staffId) && !shift.assignedStaffIds.includes(staffId)) {
            return {
              ...shift,
              requestedStaffIds: [...requested, staffId],
            };
          }
        }
        return shift;
      })
    );
  };

  // Approve a pending shift request (Admin flow)
  const handleApproveShiftRequest = (staffId: string, shiftId: string) => {
    setShifts((prevShifts) =>
      prevShifts.map((shift) => {
        if (shift.id === shiftId) {
          const requested = shift.requestedStaffIds || [];
          const updatedRequested = requested.filter((id) => id !== staffId);
          const updatedAssigned = shift.assignedStaffIds.includes(staffId)
            ? shift.assignedStaffIds
            : [...shift.assignedStaffIds, staffId];
          return {
            ...shift,
            requestedStaffIds: updatedRequested,
            assignedStaffIds: updatedAssigned,
          };
        }
        return shift;
      })
    );
  };

  // Reject a pending shift request (Admin flow)
  const handleRejectShiftRequest = (staffId: string, shiftId: string) => {
    setShifts((prevShifts) =>
      prevShifts.map((shift) => {
        if (shift.id === shiftId) {
          const requested = shift.requestedStaffIds || [];
          return {
            ...shift,
            requestedStaffIds: requested.filter((id) => id !== staffId),
          };
        }
        return shift;
      })
    );
  };

  // Auto-fill active day check
  const selectedDateObject = parseDateString(selectedDateStr);
  const dayShiftRules = getDayShiftConfig(selectedDateObject.getDay());

  return (
    <IPhoneShell>
      {/* Rota App Navigation Bar */}
      <header className="h-10 px-4 bg-neutral-950 border-b border-neutral-900 flex items-center justify-between select-none flex-shrink-0 z-20">
        <div className="flex items-center gap-2">
          {/* Custom iOS-themed Calendar Spark Logo */}
          <div className="w-5.5 h-5.5 rounded-lg bg-red-500 flex flex-col items-center justify-center text-white scale-90 relative shadow-sm">
            <span className="text-[6px] font-black tracking-widest leading-none uppercase pt-0.5">ROTA</span>
            <span className="text-[10px] font-extrabold leading-none pb-0.5">20</span>
          </div>
          <div>
            <h1 className="text-xs font-extrabold text-neutral-100 tracking-tight leading-none">
              Employee Rota Scheduling
            </h1>
            <p className="text-[8px] text-neutral-400 font-medium">Landscape Multi-Shift Organizer</p>
          </div>
        </div>

        {/* Operating status badge */}
        <div className="hidden sm:flex items-center gap-1.5 bg-neutral-900 border border-neutral-800/80 px-2 py-0.5 rounded-md">
          <Clock className="w-3 h-3 text-neutral-400" />
          <span className="text-[9px] text-neutral-300 font-sans">
            {dayShiftRules.isOpen ? (
              <span>
                Standard hours: <strong className="text-blue-400 font-bold">{dayShiftRules.morning.start} - 19:00</strong>
              </span>
            ) : (
              <span className="text-red-400 font-semibold uppercase tracking-wider text-[8px]">Closed today</span>
            )}
          </span>
        </div>

        {/* Live Active Role Simulation Switcher */}
        <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800/85 px-2 py-1 rounded-lg">
          <span className="text-[8px] text-neutral-400 font-black uppercase tracking-wider hidden md:inline">Simulation Role:</span>
          <select
            value={userRole}
            onChange={(e) => setUserRole(e.target.value as UserRole)}
            id="simulation-role-switcher"
            className="bg-transparent border-none text-[10px] font-extrabold text-blue-400 focus:outline-none cursor-pointer outline-none"
          >
            <option value="Admin" className="bg-neutral-950 text-neutral-200">🔑 Admin</option>
            <option value="General Manager" className="bg-neutral-950 text-neutral-200">💼 Gen Manager</option>
            <option value="Regular Staff" className="bg-neutral-950 text-neutral-200">👥 Regular Staff</option>
          </select>
        </div>

        {/* Header Action Button to Open Roster Sheet */}
        <button
          onClick={() => setIsStaffManagerOpen(true)}
          id="trigger-staff-director"
          className="flex items-center gap-1 text-[10px] sm:text-xs font-bold bg-blue-600 hover:bg-blue-500 active:scale-95 text-white py-1 px-2.5 rounded-md shadow-md shadow-blue-600/10 transition-all font-sans"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Team Roster ({staff.length}/{MAX_ROSTER_SIZE})</span>
        </button>
      </header>

      {/* Main Dual-Pane Dashboard Layout configured for Landscape High-density viewports */}
      <main className="flex-1 flex min-h-0 select-none overflow-hidden relative">
        
        {/* Left Side (53% width): Interactive Scrollable Calendar */}
        <section className="w-[53%] h-full flex flex-col overflow-hidden">
          <CalendarSection
            selectedDateStr={selectedDateStr}
            onSelectDate={handleSelectDate}
            shifts={shifts}
            staff={staff}
            viewMode={viewMode}
            setViewMode={setViewMode}
            currentYear={currentYear}
            currentMonth={currentMonth}
            setCurrentYear={setCurrentYear}
            setCurrentMonth={setCurrentMonth}
          />
        </section>

        {/* Right Side (47% width): Multi-Shift Operator panel and quick shift template form */}
        <section className="w-[47%] h-full flex flex-col bg-neutral-950 overflow-hidden relative">
          <ShiftDetailsController
            selectedDateStr={selectedDateStr}
            shifts={shifts}
            staff={staff}
            onAddOrUpdateShift={handleAddOrUpdateShift}
            onRemoveShift={handleRemoveShift}
            userRole={userRole}
          />
        </section>
      </main>

      {/* Slide-over Workforce Directory Drawer */}
      <StaffManager
        staff={staff}
        onAddStaff={handleAddStaff}
        onUpdateStaffMember={handleUpdateStaffMember}
        onDeleteStaff={handleDeleteStaff}
        onAssignStaffToShifts={handleAssignStaffToShifts}
        onRequestStaffShifts={handleRequestStaffShifts}
        onApproveShiftRequest={handleApproveShiftRequest}
        onRejectShiftRequest={handleRejectShiftRequest}
        isOpen={isStaffManagerOpen}
        onClose={() => setIsStaffManagerOpen(false)}
        shifts={shifts}
        userRole={userRole}
      />
    </IPhoneShell>
  );
}
