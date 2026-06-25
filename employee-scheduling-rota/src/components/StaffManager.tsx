/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, UserPlus, Phone, Briefcase, Plus, Check, Lock, Coins, ShieldAlert, Award, FileSpreadsheet, Trash2 } from 'lucide-react';
import { Staff, Shift, UserRole } from '../types';
import { calculateStaffPayroll, parseDateString, formatDateString, MAX_ROSTER_SIZE } from '../utils/rotaUtils';

interface StaffManagerProps {
  staff: Staff[];
  onAddStaff: (newStaff: Staff) => void;
  onUpdateStaffMember: (staffId: string, updates: Partial<Staff>) => void;
  onDeleteStaff: (staffId: string) => void;
  onAssignStaffToShifts: (staffId: string, shiftIds: string[]) => void;
  onRequestStaffShifts?: (staffId: string, shiftIds: string[]) => void;
  onApproveShiftRequest?: (staffId: string, shiftId: string) => void;
  onRejectShiftRequest?: (staffId: string, shiftId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  shifts: Shift[]; // for dynamic workload and payroll!
  userRole: UserRole;
}

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

export default function StaffManager({
  staff,
  onAddStaff,
  onUpdateStaffMember,
  onDeleteStaff,
  onAssignStaffToShifts,
  onRequestStaffShifts,
  onApproveShiftRequest,
  onRejectShiftRequest,
  isOpen,
  onClose,
  shifts,
  userRole,
}: StaffManagerProps) {
  const [activeTab, setActiveTab] = useState<'roster' | 'payroll'>('roster');
  
  // New Staff Form States
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [customHourlyRate, setCustomHourlyRate] = useState('10.00');
  const [selectedColor, setSelectedColor] = useState('#0A84FF');

  // Selected employee ID for profile settings view
  const [selectedStaffIdForProfile, setSelectedStaffIdForProfile] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Selected shift IDs for assignment
  const [selectedShiftIdsForAssign, setSelectedShiftIdsForAssign] = useState<string[]>([]);

  // 2-Week Pay Cycles and Payroll calculations state
  const [selectedCycleId, setSelectedCycleId] = useState<string>('cycle-2'); // default to Week 3 & 4
  const [customStartDateStr, setCustomStartDateStr] = useState<string>('2026-06-15');

  // Paid status persist states
  const [paidRecords, setPaidRecords] = useState<{ [periodKey: string]: { [staffId: string]: boolean } }>(() => {
    const cached = localStorage.getItem('payroll_paid_records');
    return cached ? JSON.parse(cached) : {};
  });

  useEffect(() => {
    localStorage.setItem('payroll_paid_records', JSON.stringify(paidRecords));
  }, [paidRecords]);

  // Predefined 2-Week Cycles
  const PREDEFINED_CYCLES = [
    { id: 'cycle-1', label: 'Week 1 & 2 (01 Jun - 14 Jun 2026)', start: '2026-06-01', end: '2026-06-14' },
    { id: 'cycle-2', label: 'Week 3 & 4 (15 Jun - 28 Jun 2026)', start: '2026-06-15', end: '2026-06-28' }, // Default
    { id: 'cycle-3', label: 'Week 5 & 6 (29 Jun - 12 Jul 2026)', start: '2026-06-29', end: '2026-07-12' },
    { id: 'cycle-4', label: 'Week 7 & 8 (13 Jul - 26 Jul 2026)', start: '2026-07-13', end: '2026-07-26' },
    { id: 'custom', label: 'Custom 2-Week Period...', start: '', end: '' },
  ];

  const getSelectedRange = () => {
    if (selectedCycleId === 'custom') {
      const start = parseDateString(customStartDateStr);
      const end = new Date(start);
      end.setDate(start.getDate() + 13);
      return {
        start: customStartDateStr,
        end: formatDateString(end),
      };
    }
    const cycle = PREDEFINED_CYCLES.find(c => c.id === selectedCycleId);
    return {
      start: cycle?.start || '2026-06-15',
      end: cycle?.end || '2026-06-28',
    };
  };

  const { start: rangeStart, end: rangeEnd } = getSelectedRange();
  const periodKey = `${rangeStart}_${rangeEnd}`;

  const biWeeklyStats = calculateStaffPayroll(shifts, staff, {
    rangeStart,
    rangeEnd,
  });

  const togglePaidStatus = (staffId: string) => {
    setPaidRecords(prev => {
      const currentPeriod = prev[periodKey] || {};
      return {
        ...prev,
        [periodKey]: {
          ...currentPeriod,
          [staffId]: !currentPeriod[staffId]
        }
      };
    });
  };

  const handleExportCSV = () => {
    let csvContent = "Employee Name,Total Hours,Total Gross Pay,Paid Status\r\n";
    staff.forEach((emp) => {
      const stats = biWeeklyStats[emp.id] || { hours: 0, cappedPay: 0 };
      const currentAdj = emp.bonusAdjustment ?? 0;
      const finalPay = stats.cappedPay + currentAdj;
      const isPaid = !!paidRecords[periodKey]?.[emp.id];
      csvContent += `"${emp.name.replace(/"/g, '""')}",${stats.hours.toFixed(1)},£${finalPay.toFixed(2)},${isPaid ? 'Paid' : 'Unpaid'}\r\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `payroll_summary_${rangeStart}_to_${rangeEnd}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset shift selections when selected staff member changes
  useEffect(() => {
    setSelectedShiftIdsForAssign([]);
  }, [selectedStaffIdForProfile]);

  // Derived selected staff member
  const selectedStaffForProfile = staff.find((s) => s.id === selectedStaffIdForProfile) || null;

  const todayStr = formatDateString(new Date());

  // Filter and sort available shifts (where current employee isn't assigned yet, and starting from today onwards)
  const availableShifts = selectedStaffForProfile
    ? shifts.filter(
        (shift) =>
          !shift.assignedStaffIds.includes(selectedStaffForProfile.id) &&
          shift.dateString >= todayStr
      )
    : [];

  const sortedAvailableShifts = [...availableShifts].sort((a, b) => {
    if (a.dateString !== b.dateString) {
      return a.dateString.localeCompare(b.dateString);
    }
    return a.type === 'Morning' ? -1 : 1;
  });

  // Calculate pending shift requests specifically for the active profile
  const pendingShiftsForThisStaff = selectedStaffForProfile
    ? shifts.filter(
        (shift) =>
          shift.requestedStaffIds?.includes(selectedStaffForProfile.id) &&
          shift.dateString >= todayStr
      )
    : [];

  const sortedPendingShiftsForThisStaff = [...pendingShiftsForThisStaff].sort((a, b) => {
    if (a.dateString !== b.dateString) {
      return a.dateString.localeCompare(b.dateString);
    }
    return a.type === 'Morning' ? -1 : 1;
  });

  // Calculate global pending shift requests across all staff for the Admin dashboard view
  const pendingRequestItems: Array<{ shift: Shift; emp: Staff }> = [];
  shifts.forEach((shift) => {
    if (shift.dateString >= todayStr && shift.requestedStaffIds) {
      shift.requestedStaffIds.forEach((staffId) => {
        const emp = staff.find((s) => s.id === staffId);
        if (emp) {
          pendingRequestItems.push({ shift, emp });
        }
      });
    }
  });

  pendingRequestItems.sort((a, b) => {
    if (a.shift.dateString !== b.shift.dateString) {
      return a.shift.dateString.localeCompare(b.shift.dateString);
    }
    return a.shift.type === 'Morning' ? -1 : 1;
  });

  const toggleShiftSelection = (shiftId: string) => {
    setSelectedShiftIdsForAssign((prev) =>
      prev.includes(shiftId) ? prev.filter((id) => id !== shiftId) : [...prev, shiftId]
    );
  };

  const isAdminOrGM = userRole === 'Admin' || userRole === 'General Manager';
  const isRosterFull = staff.length >= MAX_ROSTER_SIZE;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !role) {
      alert('Please enter employee name and role.');
      return;
    }

    if (staff.length >= MAX_ROSTER_SIZE) {
      alert(`Roster is at maximum capacity (${MAX_ROSTER_SIZE} employees).`);
      return;
    }

    const rateNum = parseFloat(customHourlyRate);
    const validatedRate = isNaN(rateNum) ? 10.00 : rateNum;

    const newStaff: Staff = {
      id: `staff-${Date.now()}`,
      name,
      role,
      phone: phone || 'Unlisted',
      color: selectedColor,
      hourlyRate: validatedRate,
      bonusAdjustment: 0,
    };

    onAddStaff(newStaff);

    setName('');
    setRole('');
    setPhone('');
    setCustomHourlyRate('10.00');
  };

  // Helper to compute total assigned shifts for staff workload tracking
  const getShiftsCountForStaff = (staffId: string) => {
    return shifts.reduce((acc, shift) => {
      if (shift.assignedStaffIds.includes(staffId)) {
        return acc + 1;
      }
      return acc;
    }, 0);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40"
          ></motion.div>

          {/* Slide-over Drawer for Landscape orientation */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-[450px] max-w-[95vw] bg-neutral-900 border-l border-neutral-800 z-50 p-4 shadow-2xl flex flex-col font-sans select-none relative overflow-hidden"
          >
            {/* Header section with tab controller */}
            <div className="flex-shrink-0 border-b border-neutral-800/80 pb-3 mb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-neutral-100 tracking-tight">Personnel & Wage Panel</h3>
                    <p className="text-[10px] text-neutral-400 font-medium">Configure team roster & track payroll hours</p>
                  </div>
                </div>
                
                <button
                  onClick={onClose}
                  id="close-personnel-panel"
                  className="text-[11px] font-bold text-neutral-400 hover:text-white bg-neutral-950 hover:bg-neutral-850 px-2.5 py-1.5 rounded-lg border border-neutral-800/60 transition"
                >
                  Close Panel
                </button>
              </div>

              {/* iOS-Style Segmented Tab Bar Control */}
              <div className="bg-neutral-950 p-0.5 rounded-xl flex items-center border border-neutral-800/60 shadow-sm">
                <button
                  onClick={() => setActiveTab('roster')}
                  id="tab-roster"
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg transition-all duration-200 font-semibold ${
                    activeTab === 'roster'
                      ? 'bg-neutral-800 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Roster Directory
                </button>

                <button
                  onClick={() => setActiveTab('payroll')}
                  id="tab-payroll"
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg transition-all duration-200 font-semibold relative ${
                    activeTab === 'payroll'
                      ? 'bg-neutral-800 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  Payroll Summary
                  {!isAdminOrGM && (
                    <Lock className="w-3 h-3 text-red-400 absolute right-3" />
                  )}
                </button>
              </div>
            </div>

            {/* Scrollable Inner Panel */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-0.5 custom-scrollbar min-h-0">
              
              <AnimatePresence mode="wait">
                {activeTab === 'roster' ? (
                  /* TAB 1: ROSTER DIRECTORY */
                  <motion.div
                    key="tab-roster-content"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    {/* Admin Approval Dashboard (Global Pending Requests across all staff) */}
                    {isAdminOrGM && pendingRequestItems.length > 0 && (
                      <div className="bg-amber-950/10 border border-amber-500/20 rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                            Pending Shift Approvals
                          </span>
                          <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                            {pendingRequestItems.length} Request{pendingRequestItems.length > 1 ? 's' : ''}
                          </span>
                        </div>

                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                          {pendingRequestItems.map(({ shift, emp }) => {
                            const parsedDate = parseDateString(shift.dateString);
                            const formattedDate = parsedDate.toLocaleDateString('en-GB', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                            });
                            const assignedCount = shift.assignedStaffIds.length;
                            const isFull = assignedCount >= 2;

                            return (
                              <div
                                key={`${shift.id}-${emp.id}`}
                                className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-850 flex items-center justify-between gap-3 text-left hover:border-neutral-800 transition"
                              >
                                <div className="min-w-0 flex-1">
                                  {/* Requester name and color badge */}
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span
                                      className="w-2 h-2 rounded-full inline-block shrink-0"
                                      style={{ backgroundColor: emp.color }}
                                    ></span>
                                    <span className="text-xs font-bold text-neutral-200 truncate">
                                      {emp.name}
                                    </span>
                                    <span className="text-[8px] text-neutral-500 font-medium">
                                      ({emp.role})
                                    </span>
                                  </div>

                                  {/* Shift details */}
                                  <div className="text-[11px] font-medium text-neutral-400">
                                    {formattedDate} · <span className="font-bold text-neutral-300">{shift.type}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[9px] text-neutral-500 font-mono">
                                      {shift.startTime} - {shift.endTime}
                                    </span>
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-black ${
                                      isFull ? 'bg-red-500/15 text-red-400' : 'bg-neutral-900 text-neutral-400'
                                    }`}>
                                      {assignedCount}/2 Staff Assigned
                                    </span>
                                  </div>
                                </div>

                                {/* Decision buttons */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => onApproveShiftRequest?.(emp.id, shift.id)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 px-2.5 rounded-lg font-bold text-[10px] transition active:scale-95 shadow-sm"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onRejectShiftRequest?.(emp.id, shift.id)}
                                    className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-1 px-2.5 rounded-lg font-bold text-[10px] border border-red-500/10 transition active:scale-95"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Add Staff Member Form */}
                    <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/60">
                      <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <UserPlus className="w-3.5 h-3.5 text-blue-400" /> Register New Team Member
                      </h4>
                      
                      <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                              Full Name *
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Jordan Smith"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="w-full bg-neutral-900 rounded border border-neutral-800 p-1.5 text-xs text-neutral-200 focus:border-blue-500 outline-none transition"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                              Role Title *
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Sales Expert"
                              value={role}
                              onChange={(e) => setRole(e.target.value)}
                              className="w-full bg-neutral-900 rounded border border-neutral-800 p-1.5 text-xs text-neutral-200 focus:border-blue-500 outline-none transition"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                              Phone Contact
                            </label>
                            <input
                              type="tel"
                              placeholder="e.g. 555-0123"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className="w-full bg-neutral-900 rounded border border-neutral-800 p-1.5 text-xs text-neutral-200 focus:border-blue-500 outline-none transition"
                            />
                          </div>

                          {/* Hourly Rate - Restricted based on role */}
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">
                                Hourly Rate (£/hr)
                              </label>
                              {!isAdminOrGM && (
                                <span className="text-[8px] text-red-400 flex items-center gap-0.5 font-bold">
                                  <Lock className="w-2 h-2" /> Locked
                                </span>
                              )}
                            </div>
                            
                            <div className="relative">
                              <span className="absolute left-2.5 top-1.5 text-neutral-500 text-xs font-semibold">£</span>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={customHourlyRate}
                                onChange={(e) => setCustomHourlyRate(e.target.value)}
                                disabled={!isAdminOrGM}
                                className={`w-full bg-neutral-900 rounded border border-neutral-800 p-1.5 pl-5.5 text-xs text-neutral-200 focus:border-blue-500 outline-none transition ${
                                  !isAdminOrGM ? 'opacity-40 cursor-not-allowed select-none bg-neutral-950' : ''
                                }`}
                                placeholder="10.00"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Color Selector */}
                        <div>
                          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                            Visual Shift Color Badge
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {APPLE_COLOR_PALETTE.map((col) => {
                              const isSelected = selectedColor === col.value;
                              return (
                                <button
                                  key={col.value}
                                  type="button"
                                  onClick={() => setSelectedColor(col.value)}
                                  className={`w-5.5 h-5.5 rounded-full border flex items-center justify-center transition-transform hover:scale-110 active:scale-95 ${
                                    isSelected
                                      ? 'border-white scale-105'
                                      : 'border-neutral-950'
                                  }`}
                                  style={{ backgroundColor: col.value }}
                                  title={col.label}
                                >
                                  {isSelected && <Check className="w-3 h-3 text-neutral-950 stroke-[3.5]" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <button
                          type="submit"
                          id="add-staff-registry-button"
                          disabled={isRosterFull}
                          className={`w-full font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition shadow-md ${
                            isRosterFull
                              ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-blue-500/10'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {isRosterFull ? `Roster Full (${MAX_ROSTER_SIZE}/${MAX_ROSTER_SIZE})` : 'Register Employee Profile'}
                        </button>
                        {isRosterFull && (
                          <p className="text-[9px] text-amber-400 text-center">
                            Maximum roster capacity reached. Remove a team member to add another.
                          </p>
                        )}
                      </form>
                    </div>

                    {/* Staff List Table */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                        Registered Team Members ({staff.length}/{MAX_ROSTER_SIZE})
                      </span>

                      <div className="overflow-hidden border border-neutral-800 rounded-xl bg-neutral-950">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-neutral-900 bg-neutral-900/40 text-neutral-400 font-mono text-[9px] uppercase tracking-wider">
                              <th className="py-2 px-3">Member</th>
                              <th className="py-2 px-2">Role</th>
                              <th className="py-2 px-2 text-center">Rate</th>
                              <th className="py-2 px-2 text-right">Phone</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-900">
                            {staff.map((emp) => {
                              const count = getShiftsCountForStaff(emp.id);
                              const currentRate = emp.hourlyRate ?? 10.00;

                              return (
                                <tr
                                  key={emp.id}
                                  onClick={() => {
                                    setSelectedStaffIdForProfile(emp.id);
                                  }}
                                  className="transition text-neutral-300 hover:bg-neutral-850 cursor-pointer active:bg-neutral-800"
                                  title="Click to view profile & manage shift assignments"
                                >
                                  <td className="py-2 px-3 font-semibold text-neutral-200">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-sm animate-pulse"
                                        style={{ backgroundColor: emp.color }}
                                      ></span>
                                      <span className="text-[11px] truncate max-w-[95px]">{emp.name}</span>
                                    </div>
                                  </td>
                                  
                                  <td className="py-2 px-2 text-neutral-400 text-[10px] truncate max-w-[85px]">
                                    {emp.role}
                                  </td>
                                  
                                  {/* Rate Column - Display rate to everyone, but edit capability restricted to Admin/GM */}
                                  <td className="py-2 px-2 text-center">
                                    {isAdminOrGM ? (
                                      <div className="flex items-center justify-center gap-0.5">
                                        <span className="text-neutral-500 text-[10px] font-semibold">£</span>
                                        <input
                                          type="number"
                                          step="0.5"
                                          min="1"
                                          value={currentRate}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            onUpdateStaffMember(emp.id, { hourlyRate: isNaN(val) ? 10.00 : val });
                                          }}
                                          className="bg-neutral-900 border border-neutral-800 rounded px-1 py-0.5 text-[11px] w-12 text-center text-white focus:border-blue-500 font-bold"
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-neutral-500 italic">
                                        🔒 Hidden
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-2 px-3 text-right font-mono text-[9px] text-neutral-400 select-all">
                                    {emp.phone}
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
                  /* TAB 2: PAYROLL SUMMARY */
                  <motion.div
                    key="tab-payroll-content"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-3.5"
                  >
                    {!isAdminOrGM ? (
                      /* LOCKED STATE IF REGULAR STAFF */
                      <div className="flex flex-col items-center justify-center p-8 bg-neutral-950 border border-neutral-800 rounded-2xl text-center shadow-lg my-10">
                        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20">
                          <Lock className="w-6 h-6 text-red-400 animate-bounce" />
                        </div>
                        <h4 className="text-sm font-extrabold text-neutral-100 tracking-tight uppercase">
                          Access Privileges Required
                        </h4>
                        <p className="text-[11px] text-neutral-400 mt-2 max-w-xs leading-relaxed">
                          Payroll parameters, employee compensation sheets, and wage summaries are strictly confidential. 
                        </p>
                        <div className="mt-5 p-2 bg-neutral-900 border border-neutral-800 rounded-lg flex items-center gap-2 max-w-xs text-left">
                          <ShieldAlert className="w-4 h-4 text-orange-400 flex-shrink-0" />
                          <span className="text-[9px] text-neutral-400 leading-normal">
                            Please use the **Role Switcher** in the top navigation bar to toggle to **Admin** or **General Manager** mode to see/edit rates.
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* ACTIVE ADMIN PAYROLL MANAGEMENT SHEET */
                      <div className="space-y-4 animate-fadeIn">
                        
                        {/* Summary Header */}
                        <div className="bg-gradient-to-r from-amber-500/10 to-blue-500/10 p-3 rounded-xl border border-neutral-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="w-5 h-5 text-amber-400 font-sans" />
                            <div>
                              <h5 className="text-xs font-bold text-white leading-tight">Live Rota Payroll</h5>
                              <p className="text-[9px] text-neutral-400">
                                £10.00/hour default · Double-shift flat rate £80.00/day
                              </p>
                            </div>
                          </div>
                          
                          {/* Total operational spend calculated live */}
                          <div className="text-right">
                            <span className="text-[9px] font-bold text-neutral-500 block uppercase">Estimated Spend</span>
                            <span className="text-sm font-black text-amber-400 font-mono">
                              £{staff.reduce((acc, emp) => {
                                const stats = biWeeklyStats[emp.id] || { cappedPay: 0 };
                                const currentAdj = emp.bonusAdjustment ?? 0;
                                return acc + stats.cappedPay + currentAdj;
                              }, 0).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Custom 2-Week Pay Cycle Selector Card */}
                        <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800/80 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                              Pay Cycle Filter
                            </span>
                            <span className="text-[9px] font-bold text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded-md">
                              14-Day Periods
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Period Dropdown */}
                            <div className="space-y-1 sm:col-span-2">
                              <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">Select Pay Cycle</label>
                              <select
                                value={selectedCycleId}
                                onChange={(e) => setSelectedCycleId(e.target.value)}
                                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs font-semibold text-neutral-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
                              >
                                {PREDEFINED_CYCLES.map(c => (
                                  <option key={c.id} value={c.id} className="bg-neutral-950 text-neutral-200">
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Custom Date Picker (Only if custom selected) */}
                          {selectedCycleId === 'custom' && (
                            <div className="pt-2.5 border-t border-neutral-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-fadeIn">
                              <div className="flex-1 space-y-1">
                                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">Custom Start Date</label>
                                <input
                                  type="date"
                                  value={customStartDateStr}
                                  onChange={(e) => {
                                    if (e.target.value) setCustomStartDateStr(e.target.value);
                                  }}
                                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-1.5 text-xs text-neutral-200 focus:border-amber-500 font-semibold outline-none"
                                />
                              </div>
                              <div className="flex-1 text-left sm:text-right self-end pb-1 text-neutral-400 text-[10px] font-semibold leading-normal">
                                End date calculated as:<br />
                                <span className="font-mono text-amber-400 font-bold">{rangeEnd}</span>
                              </div>
                            </div>
                          )}

                          {/* Active Dates Badge & Export Button */}
                          <div className="pt-2.5 border-t border-neutral-900 flex items-center justify-between gap-3">
                            <div className="flex flex-col text-left">
                              <span className="text-[9px] text-neutral-500 uppercase tracking-wider font-bold">Selected 14-Day Range</span>
                              <span className="text-[11px] font-bold text-neutral-300 font-mono">
                                {rangeStart} – {rangeEnd}
                              </span>
                            </div>
                            
                            <button
                              type="button"
                              onClick={handleExportCSV}
                              className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-[10.5px] py-1.5 px-3.5 rounded-lg flex items-center gap-1.5 transition shadow-md shadow-amber-500/10 shrink-0 cursor-pointer"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              Export Summary (CSV)
                            </button>
                          </div>
                        </div>

                        {/* Payroll Table */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                            Employee Compensation Table (Capped & Adjusted)
                          </span>

                          <div className="overflow-hidden border border-neutral-800 rounded-xl bg-neutral-950">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-neutral-900 bg-neutral-900/40 text-neutral-400 font-mono text-[9px] uppercase tracking-wider">
                                  <th className="py-2.5 px-3">Employee</th>
                                  <th className="py-2.5 px-1.5 text-center">Hours</th>
                                  <th className="py-2.5 px-1.5 text-center">Rate</th>
                                  <th className="py-2.5 px-1.5 text-center">Adj</th>
                                  <th className="py-2.5 px-2 text-right">Pay</th>
                                  <th className="py-2.5 px-2 text-center">Paid Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-900">
                                {staff.map((emp) => {
                                  const stats = biWeeklyStats[emp.id] || { hours: 0, rawPay: 0, cappedPay: 0, hasCapApplied: false, morningCount: 0, afternoonCount: 0, doubleCount: 0 };
                                  const currentRate = emp.hourlyRate ?? 10.00;
                                  const currentAdj = emp.bonusAdjustment ?? 0;
                                  
                                  // Compute final pay = Capped Pay + manual adjustment
                                  const finalPay = stats.cappedPay + currentAdj;
                                  const isPaid = !!paidRecords[periodKey]?.[emp.id];

                                  return (
                                    <tr 
                                      key={emp.id} 
                                      className={`transition duration-150 ${
                                        isPaid 
                                          ? 'bg-emerald-950/10 opacity-75 text-neutral-400 hover:bg-emerald-950/15' 
                                          : 'hover:bg-neutral-900/20 text-neutral-300'
                                      }`}
                                    >
                                      <td className="py-2.5 px-3 font-semibold">
                                        <div className="flex flex-col">
                                          <span className={`text-[11px] font-bold ${isPaid ? 'text-neutral-400 line-through' : 'text-neutral-100'}`}>
                                            {emp.name}
                                          </span>
                                          <span className="text-[9px] text-neutral-500 italic leading-tight">{emp.role}</span>
                                        </div>
                                      </td>

                                      {/* Total Hours worked */}
                                      <td className="py-2.5 px-1.5 text-center font-mono font-bold text-[11px]">
                                        {stats.hours.toFixed(1)}h
                                      </td>

                                      {/* Editable Base hourlyRate */}
                                      <td className="py-2.5 px-1.5 text-center">
                                        <div className="flex items-center justify-center gap-0.5">
                                          <span className="text-neutral-500 text-[10px]">£</span>
                                          <input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            value={currentRate}
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value);
                                              onUpdateStaffMember(emp.id, { hourlyRate: isNaN(val) ? 10.00 : val });
                                            }}
                                            className="bg-neutral-900 border border-neutral-800 rounded px-1 py-0.5 text-[10px] w-10 text-center text-neutral-200 focus:border-blue-500 font-mono font-bold"
                                          />
                                        </div>
                                      </td>

                                      {/* Editable Bonus Adjustment */}
                                      <td className="py-2.5 px-1.5 text-center">
                                        <div className="flex items-center justify-center gap-0.5">
                                          <span className="text-emerald-500 text-[9px] font-bold">+£</span>
                                          <input
                                            type="number"
                                            step="1"
                                            value={currentAdj}
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value);
                                              onUpdateStaffMember(emp.id, { bonusAdjustment: isNaN(val) ? 0 : val });
                                            }}
                                            className="bg-neutral-900 border border-neutral-800 rounded px-1 py-0.5 text-[10px] w-10 text-center text-emerald-400 focus:border-emerald-500 font-mono font-bold"
                                            placeholder="0"
                                          />
                                        </div>
                                      </td>

                                      {/* Capped and adjusted Final Pay */}
                                      <td className="py-2.5 px-2 text-right">
                                        <div className="flex flex-col items-end">
                                          <span className={`text-[11px] font-bold font-mono ${isPaid ? 'text-neutral-400' : 'text-amber-400'}`}>
                                            £{finalPay.toFixed(2)}
                                          </span>
                                          {stats.hasCapApplied && (
                                            <span className="text-[7px] text-emerald-400 bg-emerald-500/10 px-1 rounded-sm uppercase tracking-tighter font-extrabold" title="Daily double-shift cap of £80.00 triggered">
                                              £80 Cap OK
                                            </span>
                                          )}
                                        </div>
                                      </td>

                                      {/* Paid Status Toggle */}
                                      <td className="py-2.5 px-2 text-center">
                                        <button
                                          type="button"
                                          onClick={() => togglePaidStatus(emp.id)}
                                          className={`p-1 px-2.5 rounded-lg font-bold text-[9px] transition duration-200 active:scale-95 border flex items-center gap-1.5 mx-auto cursor-pointer ${
                                            isPaid
                                              ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/30'
                                              : 'bg-neutral-900 hover:bg-neutral-850 text-neutral-400 border-neutral-800 hover:border-neutral-700'
                                          }`}
                                          title={isPaid ? "Click to mark as Unpaid" : "Click to mark as Paid"}
                                        >
                                          <Check className={`w-3 h-3 ${isPaid ? 'text-emerald-400' : 'text-neutral-500'}`} />
                                          <span>{isPaid ? 'Paid' : 'Mark Paid'}</span>
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Informative Rule Legend Card */}
                        <div className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-xl space-y-2">
                          <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block">Operational Rule Tracker</span>
                          
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="p-1.5 bg-neutral-900/60 rounded border border-neutral-800/40">
                              <span className="text-amber-400 font-bold block mb-0.5">Cap Compliance</span>
                              <p className="text-neutral-400 text-[9px] leading-relaxed">
                                Individuals assigned to both Morning and Afternoon shifts on the same calendar date receive a flat £80.00 daily rate.
                              </p>
                            </div>
                            <div className="p-1.5 bg-neutral-900/60 rounded border border-neutral-800/40">
                              <span className="text-blue-400 font-bold block mb-0.5">Rate Overrides</span>
                              <p className="text-neutral-400 text-[9px] leading-relaxed">
                                Admins/GMs can edit hourly rates in real-time. Enter manual compensation/bonus modifiers next to each employee to adjust payroll totals instantly.
                              </p>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Settings Slide-in Overlay */}
            <AnimatePresence>
              {selectedStaffForProfile && (
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 240 }}
                  className="absolute inset-0 bg-neutral-900 z-50 p-4 flex flex-col font-sans"
                >
                  {/* Header */}
                  <div className="flex-shrink-0 border-b border-neutral-800/80 pb-3 mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden mr-2">
                      <div 
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: selectedStaffForProfile.color }}
                      ></div>
                      <div className="overflow-hidden">
                        <h3 className="text-sm font-extrabold text-neutral-100 tracking-tight truncate">Profile Settings</h3>
                        <p className="text-[10px] text-neutral-400 font-medium truncate">Manage details for {selectedStaffForProfile.name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedStaffIdForProfile(null);
                        setIsConfirmingDelete(false);
                      }}
                      id="back-to-roster"
                      className="text-[11px] font-bold text-neutral-400 hover:text-white bg-neutral-950 hover:bg-neutral-850 px-2.5 py-1.5 rounded-lg border border-neutral-800/60 transition shrink-0"
                    >
                      Back
                    </button>
                  </div>

                  {/* Settings Content */}
                  <div className="flex-1 overflow-y-auto space-y-4 pr-0.5 custom-scrollbar min-h-0">
                    
                    {isConfirmingDelete ? (
                      /* DELETE CONFIRMATION SCREEN */
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-red-950/20 border border-red-500/30 rounded-xl p-4 text-center space-y-4 my-4"
                      >
                        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto border border-red-500/20">
                          <ShieldAlert className="w-6 h-6 text-red-500 animate-pulse" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-red-400 uppercase tracking-wide">
                            Confirm Permanent Deletion
                          </h4>
                          <p className="text-[11px] text-neutral-400 mt-2 leading-relaxed">
                            Are you absolutely sure you want to remove <strong className="text-white font-bold">{selectedStaffForProfile.name}</strong> from the business?
                          </p>
                          <p className="text-[10px] text-red-400/80 mt-1.5 leading-normal">
                            This action cannot be undone. They will be auto-removed from all scheduled shifts.
                          </p>
                        </div>

                        <div className="pt-2 flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteStaff(selectedStaffForProfile.id);
                              setSelectedStaffIdForProfile(null);
                              setIsConfirmingDelete(false);
                            }}
                            id="confirm-delete-employee-button"
                            className="w-full bg-red-600 hover:bg-red-500 text-white font-black text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md shadow-red-500/15"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Yes, Delete Employee
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => setIsConfirmingDelete(false)}
                            className="w-full bg-neutral-800 hover:bg-neutral-750 text-neutral-300 font-bold text-xs py-2 px-3 rounded-lg transition active:scale-95"
                          >
                            Cancel & Go Back
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      /* DETAILS FORM */
                      <div className="space-y-4">
                        {/* Profile Details fields */}
                        <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800/60 space-y-3">
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">
                                Employee Name
                              </label>
                              {!isAdminOrGM && (
                                <span className="text-[8px] text-neutral-500 font-bold flex items-center gap-0.5 uppercase tracking-wider">
                                  <Lock className="w-2.5 h-2.5 text-neutral-500" /> Locked
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              disabled={!isAdminOrGM}
                              value={selectedStaffForProfile.name}
                              onChange={(e) => {
                                onUpdateStaffMember(selectedStaffForProfile.id, { name: e.target.value });
                              }}
                              className={`w-full bg-neutral-900 rounded border border-neutral-800 p-2 text-xs text-neutral-200 focus:border-blue-500 outline-none transition ${
                                !isAdminOrGM ? 'opacity-55 cursor-not-allowed bg-neutral-950' : ''
                              }`}
                            />
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">
                                Role Title
                              </label>
                              {!isAdminOrGM && (
                                <span className="text-[8px] text-neutral-500 font-bold flex items-center gap-0.5 uppercase tracking-wider">
                                  <Lock className="w-2.5 h-2.5 text-neutral-500" /> Locked
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              disabled={!isAdminOrGM}
                              value={selectedStaffForProfile.role}
                              onChange={(e) => {
                                onUpdateStaffMember(selectedStaffForProfile.id, { role: e.target.value });
                              }}
                              className={`w-full bg-neutral-900 rounded border border-neutral-800 p-2 text-xs text-neutral-200 focus:border-blue-500 outline-none transition ${
                                !isAdminOrGM ? 'opacity-55 cursor-not-allowed bg-neutral-950' : ''
                              }`}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">
                                  Phone Contact
                                </label>
                                {!isAdminOrGM && (
                                  <span className="text-[7px] text-neutral-500 font-bold flex items-center gap-0.5 uppercase">
                                    Locked
                                  </span>
                                )}
                              </div>
                              <input
                                type="tel"
                                disabled={!isAdminOrGM}
                                value={selectedStaffForProfile.phone || ''}
                                onChange={(e) => {
                                  onUpdateStaffMember(selectedStaffForProfile.id, { phone: e.target.value });
                                }}
                                className={`w-full bg-neutral-900 rounded border border-neutral-800 p-2 text-xs text-neutral-200 focus:border-blue-500 outline-none transition ${
                                  !isAdminOrGM ? 'opacity-55 cursor-not-allowed bg-neutral-950' : ''
                                }`}
                              />
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">
                                  Hourly Rate (£/hr)
                                </label>
                                {!isAdminOrGM && (
                                  <span className="text-[7px] text-neutral-500 font-bold flex items-center gap-0.5 uppercase">
                                    Locked
                                  </span>
                                )}
                              </div>
                              <div className="relative">
                                <span className="absolute left-2.5 top-2 text-neutral-500 text-xs font-semibold">£</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="1"
                                  disabled={!isAdminOrGM}
                                  value={selectedStaffForProfile.hourlyRate ?? 10.00}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    onUpdateStaffMember(selectedStaffForProfile.id, { hourlyRate: isNaN(val) ? 10.00 : val });
                                  }}
                                  className={`w-full bg-neutral-900 rounded border border-neutral-800 p-2 pl-5.5 text-xs text-neutral-200 focus:border-blue-500 outline-none transition font-mono font-bold ${
                                    !isAdminOrGM ? 'opacity-55 cursor-not-allowed bg-neutral-950' : ''
                                  }`}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Color selector for employee badge */}
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">
                                Visual Color Theme Badge
                              </label>
                              {!isAdminOrGM && (
                                <span className="text-[8px] text-neutral-500 font-bold flex items-center gap-0.5 uppercase tracking-wider">
                                  <Lock className="w-2.5 h-2.5 text-neutral-500" /> Locked
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {APPLE_COLOR_PALETTE.map((col) => {
                                const isSelected = selectedStaffForProfile.color === col.value;
                                return (
                                  <button
                                    key={col.value}
                                    type="button"
                                    disabled={!isAdminOrGM}
                                    onClick={() => {
                                      onUpdateStaffMember(selectedStaffForProfile.id, { color: col.value });
                                    }}
                                    className={`w-6 h-6 rounded-full border flex items-center justify-center transition-transform ${
                                      isAdminOrGM ? 'hover:scale-110 active:scale-95' : 'opacity-60 cursor-not-allowed'
                                    } ${
                                      isSelected
                                        ? 'border-white scale-105'
                                        : 'border-neutral-950'
                                    }`}
                                    style={{ backgroundColor: col.value }}
                                    title={col.label}
                                  >
                                    {isSelected && <Check className="w-3.5 h-3.5 text-neutral-950 stroke-[3.5]" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Shift Workload Statistics */}
                        <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800/60 space-y-2">
                          <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block">Operational Load</span>
                          <div className="flex items-center justify-between text-xs py-1">
                            <span className="text-neutral-400">Total Shifts Scheduled</span>
                            <span className="font-mono font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                              {getShiftsCountForStaff(selectedStaffForProfile.id)} shifts
                            </span>
                          </div>
                        </div>

                        {/* Pending Approvals for This Employee (Admin only) */}
                        {isAdminOrGM && sortedPendingShiftsForThisStaff.length > 0 && (
                          <div className="bg-amber-950/10 border border-amber-500/20 p-4 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest block">Pending Shift Requests</span>
                              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                {sortedPendingShiftsForThisStaff.length} Pending
                              </span>
                            </div>

                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                              {sortedPendingShiftsForThisStaff.map((shift) => {
                                const parsedDate = parseDateString(shift.dateString);
                                const formattedDate = parsedDate.toLocaleDateString('en-GB', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                });
                                const assignedCount = shift.assignedStaffIds.length;
                                const isFull = assignedCount >= 2;

                                return (
                                  <div
                                    key={shift.id}
                                    className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-850 flex items-center justify-between gap-3 text-left animate-pulse"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-bold text-neutral-200">
                                        {formattedDate} · {shift.type}
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] text-neutral-500 font-mono">
                                          {shift.startTime} - {shift.endTime}
                                        </span>
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black ${
                                          isFull ? 'bg-red-500/15 text-red-400' : 'bg-neutral-800 text-neutral-400'
                                        }`}>
                                          {assignedCount}/2 Staff Assigned
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => onApproveShiftRequest?.(selectedStaffForProfile.id, shift.id)}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 px-2 rounded-lg font-bold text-[10px] transition active:scale-95 shadow-sm"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onRejectShiftRequest?.(selectedStaffForProfile.id, shift.id)}
                                        className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-1 px-2 rounded-lg font-bold text-[10px] border border-red-500/10 transition active:scale-95"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Pending Approvals for Self (Staff view) */}
                        {!isAdminOrGM && sortedPendingShiftsForThisStaff.length > 0 && (
                          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800/60 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block">Your Pending Requests</span>
                              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full animate-pulse">
                                {sortedPendingShiftsForThisStaff.length} Requested
                              </span>
                            </div>

                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                              {sortedPendingShiftsForThisStaff.map((shift) => {
                                const parsedDate = parseDateString(shift.dateString);
                                const formattedDate = parsedDate.toLocaleDateString('en-GB', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                });
                                const assignedCount = shift.assignedStaffIds.length;

                                return (
                                  <div
                                    key={shift.id}
                                    className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-850 flex items-center justify-between gap-3 text-left"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-bold text-neutral-200">
                                        {formattedDate} · {shift.type}
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] text-neutral-500 font-mono">
                                          {shift.startTime} - {shift.endTime}
                                        </span>
                                        <span className="text-[8px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-black">
                                          {assignedCount}/2 Staff Assigned
                                        </span>
                                      </div>
                                    </div>

                                    <div className="shrink-0">
                                      <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                                        Pending Approval
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Available Shifts Section */}
                        <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800/60 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block">Available Shifts</span>
                            <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full">
                              {sortedAvailableShifts.length} Open Shifts Available
                            </span>
                          </div>

                          {sortedAvailableShifts.length === 0 ? (
                            <p className="text-[10px] text-neutral-500 italic text-center py-4">
                              No open or unassigned shifts available.
                            </p>
                          ) : (
                            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                              {sortedAvailableShifts.map((shift) => {
                                const isSelected = selectedShiftIdsForAssign.includes(shift.id);
                                const parsedDate = parseDateString(shift.dateString);
                                const formattedDate = parsedDate.toLocaleDateString('en-GB', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                });
                                const assignedCount = shift.assignedStaffIds.length;
                                const isFull = assignedCount >= 2;

                                return (
                                  <button
                                    key={shift.id}
                                    type="button"
                                    onClick={() => toggleShiftSelection(shift.id)}
                                    id={`available-shift-${shift.id}`}
                                    className={`w-full flex items-center justify-between p-2 rounded-lg border text-left transition ${
                                      isSelected
                                        ? isAdminOrGM
                                          ? 'bg-blue-950/25 border-blue-500/60'
                                          : 'bg-amber-950/25 border-amber-500/60'
                                        : 'bg-neutral-900 border-neutral-850 hover:bg-neutral-850'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {/* Custom checkbox */}
                                      <div
                                        className={`w-4 h-4 rounded flex items-center justify-center border transition shrink-0 ${
                                          isSelected
                                            ? isAdminOrGM
                                              ? 'bg-blue-600 border-blue-500'
                                              : 'bg-amber-600 border-amber-500'
                                            : 'border-neutral-700 bg-neutral-950'
                                        }`}
                                      >
                                        {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                                      </div>
                                      
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold text-neutral-200">
                                          {formattedDate} · {shift.type}
                                        </div>
                                        <div className="text-[10px] text-neutral-500 font-mono">
                                          {shift.startTime} - {shift.endTime}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Action badge/button in row */}
                                    <div className="shrink-0 flex items-center gap-2">
                                      {!isAdminOrGM && isSelected ? (
                                        <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-500/20 px-2 py-1 rounded-md flex items-center gap-1 border border-amber-500/30">
                                          Request Shift
                                        </span>
                                      ) : (
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                                          isFull ? 'bg-red-500/15 text-red-400' : 'bg-neutral-900 text-neutral-400'
                                        }`}>
                                          {assignedCount}/2 Staff Assigned
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Quick Assign / Request Action */}
                          <div className="pt-1">
                            {isAdminOrGM ? (
                              <button
                                type="button"
                                disabled={selectedShiftIdsForAssign.length === 0}
                                onClick={() => {
                                  onAssignStaffToShifts(selectedStaffForProfile.id, selectedShiftIdsForAssign);
                                  setSelectedShiftIdsForAssign([]);
                                }}
                                id="assign-selected-shifts-button"
                                className={`w-full font-black text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition duration-200 active:scale-98 shadow-sm ${
                                  selectedShiftIdsForAssign.length > 0
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-95'
                                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                }`}
                              >
                                <Plus className="w-4 h-4 text-current" />
                                Assign Selected Shifts
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={selectedShiftIdsForAssign.length === 0}
                                onClick={() => {
                                  onRequestStaffShifts?.(selectedStaffForProfile.id, selectedShiftIdsForAssign);
                                  setSelectedShiftIdsForAssign([]);
                                }}
                                id="request-selected-shifts-button"
                                className={`w-full font-black text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition duration-200 active:scale-98 shadow-sm ${
                                  selectedShiftIdsForAssign.length > 0
                                    ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer active:scale-95'
                                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                }`}
                              >
                                <Check className="w-4 h-4 text-current" />
                                Request Selected Shifts
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Big Red Delete Employee Button */}
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setIsConfirmingDelete(true)}
                            id="delete-employee-button"
                            className="w-full bg-red-600 hover:bg-red-500 border border-red-500/30 text-white font-black text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition duration-200 active:scale-98 shadow-sm"
                          >
                            <Trash2 className="w-4 h-4 text-white" />
                            Delete Employee
                          </button>
                        </div>
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
