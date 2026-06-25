/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, UserMinus, PlusCircle, AlertCircle, Sparkles, Clock, CalendarDays, FileText } from 'lucide-react';
import { Shift, Staff, ShiftType, UserRole } from '../types';
import { getDayShiftConfig, parseDateString } from '../utils/rotaUtils';

interface ShiftDetailsControllerProps {
  selectedDateStr: string;
  shifts: Shift[];
  staff: Staff[];
  onAddOrUpdateShift: (shift: Shift) => void;
  onRemoveShift: (id: string) => void;
  userRole: UserRole;
}

export default function ShiftDetailsController({
  selectedDateStr,
  shifts,
  staff,
  onAddOrUpdateShift,
  onRemoveShift,
  userRole,
}: ShiftDetailsControllerProps) {
  const [selectedStaffToAdd, setSelectedStaffToAdd] = useState<{ [key: string]: string }>({});
  const [isAddingCustomShift, setIsAddingCustomShift] = useState(false);
  const [clickedStaffId, setClickedStaffId] = useState<{ shiftId: string; staffId: string } | null>(null);
  
  // Custom Shift State for "quick custom shift"
  const [customType, setCustomType] = useState<ShiftType>('Morning');
  const [customStart, setCustomStart] = useState('09:30');
  const [customEnd, setCustomEnd] = useState('14:30');
  const [customNote, setCustomNote] = useState('');

  const parsedDate = parseDateString(selectedDateStr);
  const dayOfWeek = parsedDate.getDay();
  const config = getDayShiftConfig(dayOfWeek);
  
  // Get existing shifts for this day
  const dayShifts = shifts.filter((s) => s.dateString === selectedDateStr);

  const formattedHeaderDate = parsedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Automatically initialize defaults if needed
  const handleCreateDefaultPattern = () => {
    if (!config.isOpen) return;

    // Create Morning
    const morningShift: Shift = {
      id: `s-${selectedDateStr}-M`,
      dateString: selectedDateStr,
      type: 'Morning',
      startTime: config.morning.start,
      endTime: config.morning.end,
      assignedStaffIds: [],
      notes: '',
    };

    // Create Afternoon
    const afternoonShift: Shift = {
      id: `s-${selectedDateStr}-A`,
      dateString: selectedDateStr,
      type: 'Afternoon',
      startTime: config.afternoon.start,
      endTime: config.afternoon.end,
      assignedStaffIds: [],
      notes: '',
    };

    onAddOrUpdateShift(morningShift);
    onAddOrUpdateShift(afternoonShift);
  };

  // Staff Assignment
  const handleAssignStaff = (shiftId: string, type: ShiftType) => {
    const staffId = selectedStaffToAdd[shiftId];
    if (!staffId) return;

    const existingShift = shifts.find((s) => s.id === shiftId);
    if (!existingShift) return;

    if (existingShift.assignedStaffIds.includes(staffId)) {
      alert("This team member is already assigned to this shift.");
      return;
    }

    if (existingShift.assignedStaffIds.length >= 2) {
      alert("Peak shift capacity rules strictly limit assignment to 2 people max.");
      return;
    }

    const updatedShift: Shift = {
      ...existingShift,
      assignedStaffIds: [...existingShift.assignedStaffIds, staffId],
    };

    onAddOrUpdateShift(updatedShift);
    // Reset selection helper
    setSelectedStaffToAdd(prev => ({ ...prev, [shiftId]: '' }));
  };

  // Staff Removal (e.g. sick leave)
  const handleRemoveStaff = (shiftId: string, staffId: string) => {
    const existingShift = shifts.find((s) => s.id === shiftId);
    if (!existingShift) return;

    const updatedShift: Shift = {
      ...existingShift,
      assignedStaffIds: existingShift.assignedStaffIds.filter((id) => id !== staffId),
    };

    onAddOrUpdateShift(updatedShift);
  };

  // Update Notes
  const handleUpdateNotes = (shiftId: string, notes: string) => {
    const existingShift = shifts.find((s) => s.id === shiftId);
    if (!existingShift) return;

    const updatedShift: Shift = {
      ...existingShift,
      notes,
    };
    onAddOrUpdateShift(updatedShift);
  };

  // Add Custom Adhoc Shift
  const handleAddCustomShift = (e: React.FormEvent) => {
    e.preventDefault();
    const newShiftId = `custom-${selectedDateStr}-${Date.now()}`;
    const newShift: Shift = {
      id: newShiftId,
      dateString: selectedDateStr,
      type: customType,
      startTime: customStart,
      endTime: customEnd,
      assignedStaffIds: [],
      notes: customNote,
    };

    onAddOrUpdateShift(newShift);
    setIsAddingCustomShift(false);
    setCustomNote('');
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 p-3 overflow-y-auto custom-scrollbar select-none">
      
      {/* Selection Header */}
      <div className="mb-3.5 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Active Operations Detail</span>
        </div>
        <h2 className="text-sm font-extrabold text-white tracking-tight leading-none">
          {formattedHeaderDate}
        </h2>
      </div>

      {/* Sundays Closed Case */}
      {!config.isOpen ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-neutral-900/40 rounded-xl border border-neutral-800/60 border-dashed text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Sundays Closed</h3>
          <p className="text-[11px] text-neutral-400 max-w-xs leading-relaxed">
            Operating hours do not support Sunday slots. Tap any Monday to Saturday date on the calendar to configure shifts.
          </p>
        </div>
      ) : dayShifts.length === 0 ? (
        /* Empty / Initial State for clicked day */
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-neutral-900/40 rounded-xl border border-neutral-800/60 border-dashed text-center">
          <div className="w-11 h-11 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
            <Sparkles className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-xs font-bold text-neutral-200 mb-1">No Shifts Organized Yet</h3>
          <p className="text-[11px] text-neutral-400 max-w-xs leading-relaxed mb-4">
            Create standard Morning and Afternoon shift templates based on operating hours for this day.
          </p>

          <div className="flex gap-2 w-full max-w-[280px]">
            <button
              onClick={handleCreateDefaultPattern}
              id="initiate-shifts-btn"
              className="flex-1 flex items-center justify-center gap-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-500 active:scale-95 text-white py-2 px-3 rounded-lg transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Standard Rota Slots
            </button>
            <button
              onClick={() => {
                // Initialize form with defaults
                setCustomType('Morning');
                setCustomStart(config.morning.start);
                setCustomEnd(config.morning.end);
                setIsAddingCustomShift(true);
              }}
              id="custom-shift-btn"
              className="text-[11px] font-bold bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white py-2 px-2.5 rounded-lg transition hover:bg-neutral-850"
            >
              Ad-hoc
            </button>
          </div>
        </div>
      ) : (
        /* Normal Shift Roster Management list */
        <div className="space-y-3.5 flex-1 select-none">
          
          {/* Shift Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dayShifts.map((shift) => {
              const currentCapacity = shift.assignedStaffIds.length;
              const isFull = currentCapacity >= 2;
              const hasZero = currentCapacity === 0;

              return (
                <div
                  key={shift.id}
                  className={`bg-neutral-900 rounded-xl p-3 border transition-all duration-200 relative flex flex-col justify-between ${
                    isFull
                      ? 'border-emerald-500/20 shadow-sm shadow-emerald-500/5'
                      : hasZero
                      ? 'border-orange-500/20 shadow-sm'
                      : 'border-neutral-800'
                  }`}
                >
                  {/* Card Header information */}
                  <div className="flex justify-between items-start mb-2.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          shift.type === 'Morning' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15' 
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/15'
                        }`}>
                          {shift.type} Shift
                        </span>
                        
                        <div className="flex items-center gap-1 text-[9px] text-neutral-400 font-mono">
                          <Clock className="w-3 h-3 text-neutral-500" />
                          <span>{shift.startTime} - {shift.endTime}</span>
                        </div>
                      </div>
                    </div>

                    {/* Capacity Indicator Pill */}
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                      isFull
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : hasZero
                        ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      {currentCapacity}/2 Staff
                    </span>
                  </div>

                  {/* Body: Assigned Employees */}
                  <div className="space-y-1.5 mb-3 select-none flex-1">
                    <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">
                      Assigned Employees
                    </span>

                    {hasZero ? (
                      <p className="text-[10px] text-orange-400 italic bg-orange-500/5 py-1 px-2 rounded-lg border border-orange-500/10 flex items-center gap-1.5 select-none animate-pulse">
                        <AlertCircle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                        No team member assigned
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {shift.assignedStaffIds.map((stId) => {
                          const employee = staff.find((emp) => emp.id === stId);
                          if (!employee) return null;
                          const isAdminOrGM = userRole === 'Admin' || userRole === 'General Manager';

                          return (
                            <div key={stId} className="flex flex-col w-full">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isAdminOrGM) {
                                    setClickedStaffId(
                                      clickedStaffId?.shiftId === shift.id && clickedStaffId?.staffId === stId
                                        ? null
                                        : { shiftId: shift.id, staffId: stId }
                                    );
                                  }
                                }}
                                id={`staff-badge-${stId}-${shift.id}`}
                                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg flex items-center justify-between text-neutral-950 shadow-sm transition w-full text-left outline-none ${
                                  isAdminOrGM ? 'cursor-pointer hover:brightness-110 active:scale-[0.98]' : ''
                                }`}
                                style={{ backgroundColor: employee.color }}
                              >
                                <div className="flex items-center gap-1.5 truncate mr-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-black/40"></span>
                                  <span className="font-extrabold text-[11px] truncate">{employee.name}</span>
                                  <span className="text-[9px] font-normal text-black/60 truncate">({employee.role})</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {isAdminOrGM ? (
                                    <span className="text-[8px] uppercase tracking-wider bg-black/15 px-1.5 py-0.5 rounded font-black text-black/90">
                                      {clickedStaffId?.shiftId === shift.id && clickedStaffId?.staffId === stId ? 'Close' : 'Click to Remove'}
                                    </span>
                                  ) : (
                                    <span className="text-[8px] uppercase tracking-wider bg-black/5 px-1 py-0.5 rounded font-bold text-black/40">
                                      Assigned
                                    </span>
                                  )}
                                  <UserMinus className="w-3.5 h-3.5 text-black/70" />
                                </div>
                              </button>
                              
                              {/* If Admin/GM clicked the name, show the confirmation of "Remove from Shift" */}
                              <AnimatePresence>
                                {clickedStaffId?.shiftId === shift.id && clickedStaffId?.staffId === stId && isAdminOrGM && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden mt-1 bg-red-950/40 border border-red-500/20 rounded-lg p-2 flex items-center justify-between"
                                  >
                                    <span className="text-[9px] text-red-400 font-semibold truncate max-w-[170px]">
                                      Remove {employee.name.split(' ')[0]} from this slot?
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleRemoveStaff(shift.id, stId);
                                        setClickedStaffId(null);
                                      }}
                                      id={`confirm-remove-btn-${stId}-${shift.id}`}
                                      className="bg-red-600 hover:bg-red-500 active:scale-95 text-white text-[9px] font-black px-2 py-1 rounded shadow transition"
                                    >
                                      Remove from Shift
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Dropdown helper to assign staff */}
                  <div className="pt-2 border-t border-neutral-900 flex items-center gap-1 w-full">
                    <select
                      value={selectedStaffToAdd[shift.id] || ''}
                      onChange={(e) => setSelectedStaffToAdd(prev => ({ ...prev, [shift.id]: e.target.value }))}
                      id={`select-staff-dropdown-${shift.id}`}
                      disabled={isFull}
                      className="flex-1 bg-neutral-950 border border-neutral-800 text-[10px] font-semibold text-neutral-300 py-1 px-1.5 rounded-md outline-none focus:border-blue-500 transition disabled:opacity-50 disabled:bg-neutral-950"
                    >
                      <option value="">+ Add Employee...</option>
                      {staff.map((st) => (
                        <option
                          key={st.id}
                          value={st.id}
                          disabled={shift.assignedStaffIds.includes(st.id)}
                        >
                          {st.name} {shift.assignedStaffIds.includes(st.id) ? '(Assigned)' : `(${st.role})`}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleAssignStaff(shift.id, shift.type)}
                      disabled={isFull || !selectedStaffToAdd[shift.id]}
                      id={`assign-staff-btn-${shift.id}`}
                      className="p-1 rounded-md bg-blue-600 disabled:opacity-40 hover:bg-blue-500 active:scale-95 transition text-white"
                      title="Confirm Assignment"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onRemoveShift(shift.id)}
                      id={`remove-shift-button-${shift.id}`}
                      className="p-1 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-red-400 transition"
                      title="Delete entire shift"
                    >
                      <UserMinus className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>

                  {/* Notes / Annotations for shift */}
                  <div className="mt-3 flex gap-1 items-center bg-neutral-950/60 p-1.5 rounded-lg border border-neutral-800/40">
                    <FileText className="w-3 h-3 text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Add shift details/notes..."
                      value={shift.notes || ''}
                      onChange={(e) => handleUpdateNotes(shift.id, e.target.value)}
                      className="bg-transparent border-none text-[9px] text-neutral-400 focus:outline-none w-full"
                    />
                  </div>
                </div>
              );
            })}

            {/* Quick custom shift card button */}
            <button
              onClick={() => {
                setCustomType('Morning');
                setCustomStart(config.morning.start || '09:30');
                setCustomEnd(config.morning.end || '14:30');
                setIsAddingCustomShift(true);
              }}
              id="add-custom-adhoc-shift"
              className="flex items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-neutral-800 hover:border-neutral-700/80 bg-neutral-900/10 hover:bg-neutral-900/20 text-neutral-400 hover:text-neutral-200 transition"
            >
              <PlusCircle className="w-4 h-4 text-neutral-500" />
              <span className="text-[11px] font-bold">Add Custom Ad-hoc Shift</span>
            </button>
          </div>
        </div>
      )}

      {/* Ad-Hoc Custom Shift Modal/Form Drawer */}
      <AnimatePresence>
        {isAddingCustomShift && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="fixed inset-x-4 bottom-4 md:inset-auto md:right-8 md:top-28 md:w-[320px] bg-neutral-900/95 border border-neutral-800 rounded-xl p-4 shadow-2xl backdrop-blur-md z-50 text-sans"
          >
            <div className="flex justify-between items-center pb-2 border-b border-neutral-800 mb-3">
              <h4 className="text-xs font-extrabold text-neutral-100 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" /> New Ad-hoc Shift
              </h4>
              <button
                onClick={() => setIsAddingCustomShift(false)}
                className="text-[10px] text-neutral-400 hover:text-white bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-850"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAddCustomShift} className="space-y-3.5 select-none md:select-text">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                    Pattern Type
                  </label>
                  <select
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value as ShiftType)}
                    className="w-full bg-neutral-950 rounded border border-neutral-800 p-1.5 text-xs text-neutral-200 focus:border-blue-500 outline-none"
                  >
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                    Preset Times Selector
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (customType === 'Morning') {
                        setCustomStart(config.morning.start || '09:30');
                        setCustomEnd(config.morning.end || '14:30');
                      } else {
                        setCustomStart(config.afternoon.start || '14:30');
                        setCustomEnd(config.afternoon.end || '19:00');
                      }
                    }}
                    className="w-full text-left bg-neutral-950 hover:bg-neutral-850 rounded border border-neutral-800 p-1.5 text-[10px] text-blue-400 font-bold transition"
                  >
                    Sync Oper Hours
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                    Start Time
                  </label>
                  <input
                    type="text"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    placeholder="e.g. 09:30"
                    className="w-full bg-neutral-950 rounded border border-neutral-800 p-1.5 text-xs text-neutral-200 font-mono focus:border-blue-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                    End Time
                  </label>
                  <input
                    type="text"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    placeholder="e.g. 14:30"
                    className="w-full bg-neutral-950 rounded border border-neutral-800 p-1.5 text-xs text-neutral-200 font-mono focus:border-blue-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                  Private Duty Notes
                </label>
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="e.g. Opening manager support"
                  className="w-full bg-neutral-950 rounded border border-neutral-800 p-1.5 text-xs text-neutral-200 focus:border-blue-500 outline-none"
                />
              </div>

              <button
                type="submit"
                id="submit-custom-shift-btn"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 px-3 rounded-lg transition active:scale-95 shadow-lg shadow-blue-550/10"
              >
                Create Day Shift
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
