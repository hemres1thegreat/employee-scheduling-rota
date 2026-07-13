/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Users, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  PlusCircle, 
  Lock, 
  Key, 
  ShieldCheck, 
  ArrowRight, 
  LogOut, 
  Mail, 
  UserCheck, 
  Settings, 
  ToggleLeft, 
  ToggleRight 
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './supabaseclient';
import { User as SupabaseUser } from '@supabase/supabase-js';
import IPhoneShell from './components/IPhoneShell';
import CalendarSection from './components/CalendarSection';
import ShiftDetailsController from './components/ShiftDetailsController';
import StaffManager from './components/StaffManager';
import { Staff, Shift, UserRole } from './types';
import { 
  seedDatabaseIfEmpty,
  subscribeToStaff,
  subscribeToShifts,
  addOrUpdateShiftInFirestore,
  deleteShiftFromFirestore,
  addStaffToFirestore,
  updateStaffInFirestore,
  deleteStaffFromFirestore,
  subscribeToRegistrationSettings,
  updateRegistrationSettingsInFirestore
} from './utils/firebaseSync';
import {
  parseDateString,
  getDayShiftConfig,
} from './utils/rotaUtils';

const APPLE_COLOR_PALETTE = [
  '#0A84FF', // Blue
  '#30D158', // Green
  '#FF9F0A', // Orange
  '#BF5AF2', // Purple
  '#FF453A', // Red
  '#64D2FF', // Teal
  '#FF375F', // Rose
  '#5E5CE6', // Indigo
];

export default function App() {
  // Authentication & Session States
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('Regular Staff');
  const [currentUserProfile, setCurrentUserProfile] = useState<Staff | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Login & Registration Form States
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#0A84FF');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Firestore Real-Time Synchronized States
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [allowPublicSignUp, setAllowPublicSignUp] = useState(true);

  // Selected date defaults to June 20, 2026 (first seed Saturday)
  const [selectedDateStr, setSelectedDateStr] = useState('2026-06-20');
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  // Month navigation years/month states
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  
  // Roster section open toggles
  const [isStaffManagerOpen, setIsStaffManagerOpen] = useState(false);

  // 1. Initial Seeding and Firestore Data Subscription
  useEffect(() => {
    // Seed default records if Firestore collections are completely empty
    seedDatabaseIfEmpty();

    // Subscribe to staff changes in real-time
    const unsubscribeStaff = subscribeToStaff((updatedStaff) => {
      setStaff(updatedStaff);
    });

    // Subscribe to shifts changes in real-time
    const unsubscribeShifts = subscribeToShifts((updatedShifts) => {
      setShifts(updatedShifts);
    });

    // Subscribe to registration settings (allowPublicSignUp)
    const unsubscribeSettings = subscribeToRegistrationSettings((settings) => {
      setAllowPublicSignUp(settings.allowPublicSignUp);
    });

    return () => {
      unsubscribeStaff();
      unsubscribeShifts();
      unsubscribeSettings();
    };
  }, []);

  // 2. Authentication Observer and Role Mapping
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoadingAuth(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      updateUserRoleAndProfile(user);
      setIsLoadingAuth(false);
    });

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      updateUserRoleAndProfile(user);
      setIsLoadingAuth(false);
    });

    function updateUserRoleAndProfile(user: SupabaseUser | null) {
      if (user) {
        // Look up profile in staff list
        const profile = staff.find(
          (s) => s.id === user.id || s.email?.toLowerCase() === user.email?.toLowerCase()
        );

        if (profile) {
          setCurrentUserProfile(profile);
          // Standardize Firestore role string to matching UserRole state
          const r = profile.role.toLowerCase();
          if (r.includes('admin') || r.includes('store manager')) {
            setUserRole('Admin');
          } else if (r.includes('lead') || r.includes('general manager') || r.includes('gen manager') || r.includes('assistant')) {
            setUserRole('General Manager');
          } else {
            setUserRole('Regular Staff');
          }
        } else {
          setCurrentUserProfile(null);
          // If logged in but no profile exists, let user be Admin if email matches termz50@gmail.com, otherwise Regular Staff
          if (user.email?.toLowerCase() === 'termz50@gmail.com') {
            setUserRole('Admin');
          } else {
            setUserRole('Regular Staff');
          }
        }
      } else {
        setCurrentUserProfile(null);
        setUserRole('Regular Staff');
      }
    }

    return () => {
      subscription.unsubscribe();
    };
  }, [staff]);

  // Adjust month navigation if selected date changes radically (keep monthly grid aligned)
  const handleSelectDate = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    const parsed = parseDateString(dateStr);
    setCurrentYear(parsed.getFullYear());
    setCurrentMonth(parsed.getMonth());
  };

  // 3. Firestore Action Handlers (Replacing local state writes)
  const handleAddOrUpdateShift = async (updatedShift: Shift) => {
    try {
      await addOrUpdateShiftInFirestore(updatedShift);
    } catch (e) {
      alert('Failed to save shift changes: ' + e);
    }
  };

  const handleRemoveShift = async (shiftId: string) => {
    try {
      await deleteShiftFromFirestore(shiftId);
    } catch (e) {
      alert('Failed to delete shift: ' + e);
    }
  };

  const handleAddStaff = async (newStaff: Staff) => {
    try {
      await addStaffToFirestore(newStaff);
    } catch (e) {
      alert('Failed to add staff member: ' + e);
    }
  };

  const handleUpdateStaffMember = async (staffId: string, updates: Partial<Staff>) => {
    try {
      await updateStaffInFirestore(staffId, updates);
    } catch (e) {
      alert('Failed to update staff member: ' + e);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    try {
      // Delete core profile
      await deleteStaffFromFirestore(staffId);
      
      // Clear assignments and pending requests containing deleted staff member
      const affectedShifts = shifts.filter(
        (s) => s.assignedStaffIds.includes(staffId) || s.requestedStaffIds?.includes(staffId)
      );

      for (const shift of affectedShifts) {
        const updatedShift = {
          ...shift,
          assignedStaffIds: shift.assignedStaffIds.filter((id) => id !== staffId),
          requestedStaffIds: (shift.requestedStaffIds || []).filter((id) => id !== staffId)
        };
        await addOrUpdateShiftInFirestore(updatedShift);
      }
    } catch (e) {
      alert('Failed to remove staff member: ' + e);
    }
  };

  const handleAssignStaffToShifts = async (staffId: string, shiftIds: string[]) => {
    try {
      for (const id of shiftIds) {
        const shift = shifts.find((s) => s.id === id);
        if (shift && !shift.assignedStaffIds.includes(staffId)) {
          const updatedShift = {
            ...shift,
            assignedStaffIds: [...shift.assignedStaffIds, staffId],
          };
          await addOrUpdateShiftInFirestore(updatedShift);
        }
      }
    } catch (e) {
      alert('Failed to assign shifts: ' + e);
    }
  };

  const handleRequestStaffShifts = async (staffId: string, shiftIds: string[]) => {
    try {
      for (const id of shiftIds) {
        const shift = shifts.find((s) => s.id === id);
        if (shift) {
          const requested = shift.requestedStaffIds || [];
          if (!requested.includes(staffId) && !shift.assignedStaffIds.includes(staffId)) {
            const updatedShift = {
              ...shift,
              requestedStaffIds: [...requested, staffId],
            };
            await addOrUpdateShiftInFirestore(updatedShift);
          }
        }
      }
    } catch (e) {
      alert('Failed to request shifts: ' + e);
    }
  };

  const handleApproveShiftRequest = async (staffId: string, shiftId: string) => {
    try {
      const shift = shifts.find((s) => s.id === shiftId);
      if (shift) {
        const requested = shift.requestedStaffIds || [];
        const updatedRequested = requested.filter((id) => id !== staffId);
        const updatedAssigned = shift.assignedStaffIds.includes(staffId)
          ? shift.assignedStaffIds
          : [...shift.assignedStaffIds, staffId];
        
        const updatedShift = {
          ...shift,
          requestedStaffIds: updatedRequested,
          assignedStaffIds: updatedAssigned,
        };
        await addOrUpdateShiftInFirestore(updatedShift);
      }
    } catch (e) {
      alert('Failed to approve request: ' + e);
    }
  };

  const handleRejectShiftRequest = async (staffId: string, shiftId: string) => {
    try {
      const shift = shifts.find((s) => s.id === shiftId);
      if (shift) {
        const requested = shift.requestedStaffIds || [];
        const updatedShift = {
          ...shift,
          requestedStaffIds: requested.filter((id) => id !== staffId),
        };
        await addOrUpdateShiftInFirestore(updatedShift);
      }
    } catch (e) {
      alert('Failed to reject request: ' + e);
    }
  };

  // Toggle Public Sign-ups (Admin Setting)
  const handleTogglePublicRegistration = async () => {
    try {
      await updateRegistrationSettingsInFirestore(!allowPublicSignUp);
    } catch (e) {
      alert('Failed to update registration settings: ' + e);
    }
  };

  // 4. Auth Actions (Login / Signup / Signout)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setIsSubmitting(true);

    if (!isSupabaseConfigured) {
      setAuthError('Supabase is not configured yet. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your settings.');
      setIsSubmitting(false);
      return;
    }

    if (!email || !password) {
      setAuthError('Please fill out all required fields.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (authTab === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setAuthSuccess('Logged in successfully!');
      } else {
        // Password confirmation check
        if (password !== confirmPassword) {
          setAuthError('Passwords do not match. Please verify both fields.');
          setIsSubmitting(false);
          return;
        }

        // Under Registration
        // If registration is disabled AND user is not the special owner, reject.
        const isSpecialOwner = email.toLowerCase() === 'termz50@gmail.com';
        if (!allowPublicSignUp && !isSpecialOwner) {
          setAuthError('Public registration is currently disabled by Admin. Please ask your administrator to enable it.');
          setIsSubmitting(false);
          return;
        }

        if (!fullName) {
          setAuthError('Please enter your full name for the rota profile.');
          setIsSubmitting(false);
          return;
        }

        // Create user in Supabase Auth
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        const newUser = data?.user;
        if (!newUser) {
          throw new Error('Could not register account. Please check your Supabase settings.');
        }
        
        // Create corresponding Staff record in Firestore
        const newStaff: Staff = {
          id: newUser.id,
          name: fullName,
          role: 'Sales Associate',
          color: selectedColor,
          phone: 'Unlisted',
          hourlyRate: 10.00,
          bonusAdjustment: 0,
          email: email.toLowerCase()
        };

        await addStaffToFirestore(newStaff);
        setAuthSuccess('Account registered and staff profile created!');
      }
    } catch (err: any) {
      console.error(err);
      let msg = err.message || 'An authentication error occurred.';
      if (msg.includes('invalid claim') || msg.includes('Invalid login')) {
        msg = 'Invalid email or password.';
      }
      setAuthError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  // Auto-fill active day check
  const selectedDateObject = parseDateString(selectedDateStr);
  const dayShiftRules = getDayShiftConfig(selectedDateObject.getDay());

  // Show beautiful screen loading spinner during initial auth evaluation
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#0B2545]/20 border-t-[#0B2545] rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-500 font-sans tracking-wide">Syncing Security Credentials...</p>
        </div>
      </div>
    );
  }

  // Auth Guard / Access Screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden transition-all duration-300">
          {/* Brand/Security Header */}
          <div className="bg-[#0B2545] p-6 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#F9C513]/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl -ml-8 -mb-8"></div>
            
            {/* Custom Logo Container */}
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F9C513]/15 border border-[#F9C513]/30 text-[#F9C513] mb-3">
              <Lock className="w-6 h-6" />
            </div>
            
            <h1 className="text-lg font-black text-white tracking-tight">Rota Staff Multi-User Gate</h1>
            <p className="text-xs text-slate-300 mt-1 font-sans">Authorized Scheduling & Payroll Access</p>

            {/* Segmented control for Tabs */}
            <div className="mt-5 bg-white/10 p-1 rounded-xl flex items-center border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('signin');
                  setPassword('');
                  setConfirmPassword('');
                  setAuthError('');
                  setAuthSuccess('');
                }}
                className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                  authTab === 'signin' 
                    ? 'bg-white text-[#0B2545] shadow-md' 
                    : 'text-white hover:text-white/80'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('signup');
                  setPassword('');
                  setConfirmPassword('');
                  setAuthError('');
                  setAuthSuccess('');
                }}
                className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                  authTab === 'signup' 
                    ? 'bg-white text-[#0B2545] shadow-md' 
                    : 'text-white hover:text-white/80'
                }`}
              >
                Sign Up / Register
              </button>
            </div>
          </div>

          {/* Form Section */}
          <form onSubmit={handleAuthSubmit} className="p-6 space-y-4">
            
            {/* Registration specific fields */}
            {authTab === 'signup' && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Liam Thompson"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#F9C513]/30 focus:border-[#F9C513] text-slate-800 font-medium"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <UserCheck className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                    Highlight Color for Shifts
                  </label>
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    {APPLE_COLOR_PALETTE.map((color) => (
                      <button
                        type="button"
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`w-6 h-6 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
                          selectedColor === color 
                            ? 'scale-110 ring-2 ring-slate-800 border-white' 
                            : 'border-slate-200 hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        {selectedColor === color && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Common fields (Email, Password) */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#F9C513]/30 focus:border-[#F9C513] text-slate-800 font-medium"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#F9C513]/30 focus:border-[#F9C513] text-slate-800 font-medium"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Key className="w-4 h-4" />
                </div>
              </div>
            </div>

            {authTab === 'signup' && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#F9C513]/30 focus:border-[#F9C513] text-slate-800 font-medium"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Key className="w-4 h-4" />
                  </div>
                </div>
              </div>
            )}

            {/* Public signups status block inside signup tab */}
            {authTab === 'signup' && !allowPublicSignUp && email.toLowerCase() !== 'termz50@gmail.com' && (
              <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <span className="font-bold block">Public Sign-up Disabled</span>
                  Registration is currently locked. Only special testers can bypass.
                </div>
              </div>
            )}

            {/* Success and Error messages */}
            {authError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-red-600" />
                <span>{authError}</span>
              </div>
            )}

            {authSuccess && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
                <ShieldCheck className="w-4.5 h-4.5 shrink-0 text-emerald-600" />
                <span>{authSuccess}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full px-4 py-3 bg-[#0B2545] hover:bg-[#134074] text-white rounded-xl text-xs font-black shadow-md shadow-blue-900/10 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70`}
            >
              <span>{isSubmitting ? 'Authenticating...' : authTab === 'signin' ? 'Verify Credentials' : 'Register Account'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Secure footer helper info */}
          <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-[10px] text-slate-500 font-medium">
              Requires email format validation. Registration status is toggleable by Admin users.
            </span>
          </div>
        </div>
      </div>
    );
  }

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
        <div className="hidden lg:flex items-center gap-1.5 bg-[#134074]/30 border border-[#134074]/50 px-2 py-0.5 rounded-md">
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

        {/* Dynamic Controls Header Group */}
        <div className="flex items-center gap-2">
          {/* Dynamic Registration Toggle Setting for Admins ONLY */}
          {userRole === 'Admin' && (
            <button
              onClick={handleTogglePublicRegistration}
              title="Toggle Public Registrations on Sign Up Page"
              className="flex items-center gap-1 bg-[#134074]/30 border border-[#134074]/50 px-2 py-1 rounded-lg text-slate-200 hover:bg-[#134074]/50 hover:text-white transition-all cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-[#F9C513]" />
              <span className="text-[9px] font-bold hidden md:inline">
                {allowPublicSignUp ? '🔓 Public Sign-ups On' : '🔒 Public Sign-ups Off'}
              </span>
            </button>
          )}

          {/* Active Logged-in User Badge */}
          <div className="flex items-center gap-1.5 bg-[#134074]/30 border border-[#134074]/50 px-2 py-1 rounded-lg select-none">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentUserProfile?.color || '#F9C513' }}></div>
            <div className="text-left leading-none">
              <span className="text-[9px] font-extrabold text-[#F9C513] block truncate max-w-[80px]">
                {currentUserProfile?.name || currentUser.email?.split('@')[0]}
              </span>
              <span className="text-[7px] text-slate-300 font-medium uppercase block mt-0.5">
                {userRole === 'Admin' ? '🔑 Admin' : userRole === 'General Manager' ? '💼 Manager' : '👥 Staff'}
              </span>
            </div>
          </div>

          {/* Header Action Button to Open Roster Sheet - Golden Yellow (#F9C513) */}
          <button
            onClick={() => setIsStaffManagerOpen(true)}
            id="trigger-staff-director"
            className="flex items-center gap-1 text-[9px] font-black bg-[#F9C513] hover:bg-amber-400 active:scale-95 text-black py-1 px-2.5 rounded-md shadow-md shadow-[#F9C513]/15 transition-all font-sans cursor-pointer shrink-0"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Roster ({staff.length})</span>
          </button>

          {/* Log Out Button */}
          <button
            onClick={handleSignOut}
            title="Sign Out of Session"
            className="p-1 px-1.5 bg-red-600/25 border border-red-500/30 hover:bg-red-600 text-red-300 hover:text-white transition-all rounded-md cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Dual-Pane Dashboard Layout with white (#FFFFFF) background & black (#000000) text */}
      <main className="flex-1 flex flex-col md:flex-row min-h-0 select-none overflow-y-auto md:overflow-hidden relative bg-white text-black">
        
        {/* Left Side: Interactive Scrollable Calendar */}
        <section className="w-full md:w-[53%] h-auto md:h-full flex flex-col overflow-visible md:overflow-hidden bg-white shrink-0">
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
        <section className="w-full md:w-[47%] h-auto md:h-full flex flex-col bg-white overflow-visible md:overflow-hidden relative border-t md:border-t-0 md:border-l border-slate-200 shrink-0">
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
