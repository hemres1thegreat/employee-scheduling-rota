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
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
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
    setStaff((prevStaff) => [...prevStaff, newStaff]);
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
      {/* Rota App Navigation Bar - Deep Navy Blue (#0B2545) for primary structural header */}
      <header className="h-10 px-4 bg-[#0B2545] border-b border-blue-900/40 flex items-center justify-between select-none flex-shrink-0 z-20">
        <div className="flex items-center gap-2">
          {/* Custom iOS-themed Calendar Spark Logo */}
          <div className="w-5.5 h-5.5 rounded-lg bg-red-500 flex flex-col items-center justify-center text-white scale-90 relative shadow-sm">
            <span className="text-[6px] font-black tracking-widest leading-none uppercase pt-0.5">ROTA</span>
            <span className="text-[10px] font-extrabold leading-none pb-0.5">20</span>
          </div>
          <div>
            <h1 className="text-xs font-extrabold text-white tracking-tight leading-none">
              Employee Rota Scheduling
            </h1>
            <p className="text-[8px] text-slate-300 font-medium">Responsive Multi-Shift Organizer</p>
          </div>
        </div>

        {/* Operating status badge */}
        <div className="hidden sm:flex items-center gap-1.5 bg-[#134074]/30 border border-[#134074]/50 px-2 py-0.5 rounded-md">
          <Clock className="w-5 h-5 text-[#F9C513]" />
          <span className="text-[9px] text-slate-200 font-sans">
            {dayShiftRules.isOpen ? (
              <span>
                Standard hours: <strong className="text-[#F9C513] font-bold">{dayShiftRules.morning.start} - 19:00</strong>
              </span>
            ) : (
              <span className="text-red-400 font-semibold uppercase tracking-wider text-[8px]">Closed today</span>
            )}
          </span>
        </div>

        {/* Live Active Role Simulation Switcher */}
        <div className="flex items-center gap-1 bg-[#134074]/30 border border-[#134074]/50 px-2 py-1 rounded-lg">
          <span className="text-[8px] text-slate-300 font-black uppercase tracking-wider hidden md:inline">Simulation Role:</span>
          <select
            value={userRole}
            onChange={(e) => setUserRole(e.target.value as UserRole)}
            id="simulation-role-switcher"
            className="bg-transparent border-none text-[10px] font-extrabold text-[#F9C513] focus:outline-none cursor-pointer outline-none"
          >
            <option value="Admin" className="bg-[#0B2545] text-[#F9C513] font-bold">🔑 Admin</option>
            <option value="General Manager" className="bg-[#0B2545] text-[#F9C513] font-bold">💼 Gen Manager</option>
            <option value="Regular Staff" className="bg-[#0B2545] text-[#F9C513] font-bold">👥 Regular Staff</option>
          </select>
        </div>

        {/* Header Action Button to Open Roster Sheet - Golden Yellow (#F9C513) */}
        <button
          onClick={() => setIsStaffManagerOpen(true)}
          id="trigger-staff-director"
          className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black bg-[#F9C513] hover:bg-amber-400 active:scale-95 text-black py-1 px-3 rounded-md shadow-md shadow-[#F9C513]/15 transition-all font-sans cursor-pointer"
        >
          <Users className="w-5.5 h-5.5" />
          <span>Team Roster ({staff.length})</span>
        </button>
      </header>

      {/* Main Dual-Pane Dashboard Layout with white (#FFFFFF) background & black (#000000) text */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0 select-none overflow-y-auto lg:overflow-hidden relative bg-white text-black">
        
        {/* Left Side: Interactive Scrollable Calendar */}
        <section className="w-full lg:w-[53%] h-auto lg:h-full flex flex-col overflow-visible lg:overflow-hidden bg-white shrink-0">
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

        {/* Right Side: Multi-Shift Operator panel and quick shift template form */}
        <section className="w-full lg:w-[47%] h-auto lg:h-full flex flex-col bg-white overflow-visible lg:overflow-hidden relative border-t lg:border-t-0 lg:border-l border-slate-200 shrink-0">
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
