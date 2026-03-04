/**
 * Profile Settings page - Modern, minimal, and aesthetic design
 */

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseClient, useSupabaseSession } from "@/components/auth/SupabaseSessionProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Container } from "@/components/layout/Container";
import { CountdownCard } from "@/components/profile/CountdownCard";
import { DeleteAccountModal } from "@/components/profile/DeleteAccountModal";
import { ChangePasswordModal } from "@/components/profile/ChangePasswordModal";
import { ChangeEmailModal } from "@/components/profile/ChangeEmailModal";
import { ResetDataModal } from "@/components/profile/ResetDataModal";
import { UsernameSetupModal } from "@/components/profile/UsernameSetupModal";
import { cn } from "@/lib/utils";
import { 
  LogOut, 
  Trash2, 
  Download, 
  RotateCcw, 
  Mail, 
  Lock, 
  User,
  BookOpen, 
  Settings, 
  Eye,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Edit3,
  X,
  Check,
  CreditCard
} from "lucide-react";
import type { ExamType } from "@/lib/profile/countdown";
import { useTheme } from "@/contexts/ThemeContext";

type Preferences = {
  username: string | null;
  last_username_change: string | null;
  exam_preference: ExamType | null;
  esat_subjects: string[];
  is_early_applicant: boolean;
  has_extra_time: boolean;
  extra_time_percentage: number;
  has_rest_breaks: boolean;
  font_size: 'small' | 'medium' | 'large';
  reduced_motion: boolean;
  dark_mode: boolean;
};

const ESAT_SUBJECTS = ['Math 1', 'Math 2', 'Chemistry', 'Biology', 'Physics'];

// Subject colors for ESAT
const getSubjectColor = (subject: string) => {
  const colors: Record<string, { bg: string; text: string; hover: string }> = {
    'Math 1': { bg: 'bg-[#5da8f0]/20', text: 'text-[#5da8f0]', hover: 'hover:bg-[#5da8f0]/30' },
    'Math 2': { bg: 'bg-[#5da8f0]/20', text: 'text-[#5da8f0]', hover: 'hover:bg-[#5da8f0]/30' },
    'Physics': { bg: 'bg-[#a78bfa]/20', text: 'text-[#a78bfa]', hover: 'hover:bg-[#a78bfa]/30' },
    'Chemistry': { bg: 'bg-[#ef7d7d]/20', text: 'text-[#ef7d7d]', hover: 'hover:bg-[#ef7d7d]/30' },
    'Biology': { bg: 'bg-[#85BC82]/20', text: 'text-[#85BC82]', hover: 'hover:bg-[#85BC82]/30' },
  };
  return colors[subject] || { bg: 'bg-white/5', text: 'text-white/90', hover: 'hover:bg-white/10' };
};

type SettingSection = {
  id: string;
  title: string;
  icon: React.ReactNode;
};

const SETTING_SECTIONS: SettingSection[] = [
  { id: 'account', title: 'Account', icon: <User className="w-4 h-4" /> },
  { id: 'exam', title: 'Exam & Practice', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'data', title: 'Data Management', icon: <Download className="w-4 h-4" /> },
  { id: 'appearance', title: 'Appearance', icon: <Eye className="w-4 h-4" /> },
];

export default function ProfilePage() {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const session = useSupabaseSession();
  const { theme, toggleTheme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('account');
  const [preferences, setPreferences] = useState<Preferences>({
    username: null,
    last_username_change: null,
    exam_preference: null,
    esat_subjects: [],
    is_early_applicant: true,
    has_extra_time: false,
    extra_time_percentage: 25,
    has_rest_breaks: false,
    font_size: 'medium',
    reduced_motion: false,
    dark_mode: false,
  });
  const [showUsernameSetup, setShowUsernameSetup] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<{
    available: boolean | null;
    message: string | null;
  }>({ available: null, message: null });
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState<string>("");
  const [localESATSubjects, setLocalESATSubjects] = useState<string[]>([]);
  
  // Modal states
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [showResetData, setShowResetData] = useState(false);

  // Load preferences
  useEffect(() => {
    async function loadPreferences() {
      if (!session?.user) {
        router.push("/login?redirectTo=/profile");
        return;
      }

      try {
        setEmail(session.user.email || "");

        const response = await fetch("/api/profile/preferences");
        if (response.ok) {
          const data = await response.json();
          setPreferences({
            username: data.username || null,
            last_username_change: data.last_username_change || null,
            exam_preference: data.exam_preference || null,
            esat_subjects: data.esat_subjects || [],
            is_early_applicant: data.is_early_applicant ?? true,
            has_extra_time: data.has_extra_time ?? false,
            extra_time_percentage: data.extra_time_percentage ?? 25,
            has_rest_breaks: data.has_rest_breaks ?? false,
            font_size: data.font_size || 'medium',
            reduced_motion: data.reduced_motion ?? false,
            dark_mode: data.dark_mode ?? false,
          });
          
          // Show username setup if username is missing
          if (!data.username) {
            setShowUsernameSetup(true);
          }
        }
      } catch (error) {
        console.error("[profile] Error loading preferences:", error);
      } finally {
        setLoading(false);
      }
    }

    loadPreferences();
  }, [session, router]);

  const savePreferences = async (updates: Partial<Preferences>, section?: string) => {
    if (!session?.user) return;

    setSaving(section || "preferences");
    try {
      const response = await fetch("/api/profile/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save preferences");
      }

      const data = await response.json();
      setPreferences((prev) => ({ ...prev, ...data }));
      
      if (updates.exam_preference !== undefined) {
        router.refresh();
      }
    } catch (error: any) {
      console.error("[profile] Error saving preferences:", error);
      alert(error.message || "Failed to save preferences");
    } finally {
      setSaving(null);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("[profile] Logout error:", error);
        alert("Failed to logout. Please try again.");
        setLoading(false);
        return;
      }
      // Wait a moment for the session state to update
      await new Promise(resolve => setTimeout(resolve, 100));
      // Force a hard redirect to ensure session is cleared
      window.location.href = "/login";
    } catch (err) {
      console.error("[profile] Logout error:", err);
      alert("Failed to logout. Please try again.");
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const response = await fetch("/api/profile/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "DELETE" }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete account");
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("[profile] Logout error after delete:", error);
      }
      // Wait a moment for the session state to update
      await new Promise(resolve => setTimeout(resolve, 100));
      // Force a hard redirect to ensure session is cleared
      window.location.href = "/login";
    } catch (err) {
      console.error("[profile] Logout error after delete:", err);
      // Still redirect even if signOut fails
      window.location.href = "/login";
    }
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    const response = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to change password");
    }
  };

  const handleChangeEmail = async (newEmail: string, password: string) => {
    const response = await fetch("/api/profile/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to change email");
    }

    setEmail(newEmail);
  };

  const handleExportData = async () => {
    try {
      const response = await fetch("/api/profile/export");
      if (!response.ok) throw new Error("Failed to export data");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `user-data-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("[profile] Error exporting data:", error);
      alert(error.message || "Failed to export data");
    }
  };

  const handleResetData = async () => {
    const response = await fetch("/api/profile/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "RESET" }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to reset data");
    }

    router.refresh();
  };

  // Initialize local ESAT subjects when preferences load or exam preference changes
  useEffect(() => {
    if (preferences.exam_preference === 'ESAT') {
      if (preferences.esat_subjects) {
        setLocalESATSubjects(preferences.esat_subjects);
      } else {
        setLocalESATSubjects([]);
      }
    } else {
      setLocalESATSubjects([]);
    }
  }, [preferences.esat_subjects, preferences.exam_preference]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingUsername && usernameInputRef.current) {
      usernameInputRef.current.focus();
    }
  }, [isEditingUsername]);

  // Check if username can be edited (14-day restriction)
  const canEditUsername = useCallback(() => {
    if (!preferences.last_username_change) return true;
    const lastChange = new Date(preferences.last_username_change);
    const daysSinceChange = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceChange >= 14;
  }, [preferences.last_username_change]);

  // Check if username is valid
  const isUsernameValid = useCallback((value: string) => {
    if (value.length < 2) return false;
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    return usernameRegex.test(value) && value.length <= 20;
  }, []);

  // Debounced username availability check
  const checkUsernameAvailability = useCallback(async (value: string) => {
    if (!value || value === preferences.username) {
      setUsernameAvailability({ available: null, message: null });
      return;
    }

    if (!isUsernameValid(value)) {
      setUsernameAvailability({
        available: false,
        message: 'Username must be 2-20 characters and contain only letters, numbers, underscores, or hyphens'
      });
      return;
    }

    setUsernameChecking(true);
    try {
      const response = await fetch(`/api/profile/username/check?username=${encodeURIComponent(value)}`);
      const data = await response.json();
      if (response.ok) {
        setUsernameAvailability({
          available: data.available,
          message: data.message
        });
      }
    } catch (err) {
      setUsernameAvailability({ available: null, message: null });
    } finally {
      setUsernameChecking(false);
    }
  }, [preferences.username, isUsernameValid]);

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle username input change with debounce - stable handler
  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsernameInput(value);
    setUsernameError(null);
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Debounce the availability check
    debounceTimerRef.current = setTimeout(() => {
      checkUsernameAvailability(value);
    }, 500);
  }, [checkUsernameAvailability]);

  // Handle save username
  const handleSaveUsername = useCallback(async () => {
    if (!usernameInput || usernameInput === preferences.username) {
      setIsEditingUsername(false);
      setUsernameInput("");
      return;
    }

    if (!isUsernameValid(usernameInput)) {
      setUsernameError('Username must be 2-20 characters and contain only letters, numbers, underscores, or hyphens');
      return;
    }

    if (usernameAvailability.available !== true) {
      setUsernameError('Please choose an available username');
      return;
    }

    setSaving("username");
    setUsernameError(null);

    try {
      await savePreferences({ username: usernameInput.trim() }, "username");
      setUsernameInput("");
      setIsEditingUsername(false);
    } catch (err: any) {
      setUsernameError(err.message || 'Failed to save username');
    } finally {
      setSaving(null);
    }
  }, [usernameInput, preferences.username, isUsernameValid, usernameAvailability, savePreferences]);

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    setUsernameInput("");
    setUsernameAvailability({ available: null, message: null });
    setUsernameError(null);
    setIsEditingUsername(false);
  }, []);

  // Handle start editing
  const handleStartEdit = useCallback(() => {
    if (!canEditUsername()) return;
    setUsernameInput(preferences.username || "");
    setIsEditingUsername(true);
  }, [preferences.username, canEditUsername]);

  const handleESATSubjectToggle = (subject: string) => {
    const current = localESATSubjects || [];
    let newSubjects: string[];
    
    if (current.includes(subject)) {
      // Deselect if already selected
      newSubjects = current.filter((s) => s !== subject);
    } else {
      // If already at 3, replace the first one with the new selection
      if (current.length >= 3) {
        newSubjects = [current[1], current[2], subject];
      } else {
        newSubjects = [...current, subject];
      }
    }

    setLocalESATSubjects(newSubjects);
  };

  const handleSaveESATSubjects = async () => {
    if (localESATSubjects.length !== 3) {
      alert("Please select exactly 3 subjects");
      return;
    }
    await savePreferences({ esat_subjects: localESATSubjects }, "esat_subjects");
  };

  if (!session?.user) {
    return null;
  }

  if (loading) {
    return (
      <Container size="lg">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Container>
    );
  }


  const getTimeWithExtraTime = () => {
    if (!preferences.has_extra_time) return null;
    const percentage = preferences.extra_time_percentage || 25;
    if (preferences.exam_preference === 'TMUA') {
      const baseMinutes = 150;
      const extra = baseMinutes * (percentage / 100);
      const total = baseMinutes + extra;
      const hours = Math.floor(total / 60);
      const minutes = Math.round(total % 60);
      return `${hours}h ${minutes}m`;
    } else if (preferences.exam_preference === 'ESAT') {
      const baseMinutes = 40;
      const extra = baseMinutes * (percentage / 100);
      const total = baseMinutes + extra;
      return `${Math.round(total)}m`;
    }
    return null;
  };

  const SettingItem = ({ 
    label, 
    description, 
    children, 
    className 
  }: { 
    label: string; 
    description?: string; 
    children: React.ReactNode;
    className?: string;
  }) => (
    <div className={cn("space-y-2", className)}>
      <div className="space-y-1">
        <label className="text-sm font-medium text-text">{label}</label>
        {description && (
          <p className="text-xs text-text-muted">{description}</p>
        )}
      </div>
      {children}
    </div>
  );

  const Toggle = ({ 
    checked, 
    onChange, 
    label, 
    description 
  }: { 
    checked: boolean; 
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
  }) => (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div 
          className={cn(
            "w-11 h-6 rounded-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            checked ? "bg-primary shadow-lg shadow-primary/30" : "bg-surface-elevated"
          )}
          style={{
            transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div 
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-lg transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              transform: checked ? 'translateX(1.25rem) scale(1)' : 'translateX(0.125rem) scale(1)',
              left: checked ? 'auto' : '0.125rem',
              right: checked ? '0.125rem' : 'auto',
            }}
          />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text group-hover:text-text-muted transition-colors">
          {label}
        </div>
        {description && (
          <div className="text-xs text-text-muted mt-1">{description}</div>
        )}
      </div>
    </label>
  );

  const RadioGroup = ({ 
    value, 
    onChange, 
    options 
  }: { 
    value: string; 
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <div className="flex gap-3">
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
              "relative overflow-hidden",
              isSelected
                ? "bg-primary text-white shadow-lg shadow-primary/30"
                : "bg-white/5 text-text-muted hover:bg-white/10 hover:text-text"
            )}
            style={{
              transform: isSelected ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <Container size="lg">
      <div className="py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text mb-2">Settings</h1>
          <p className="text-sm text-text-muted">Manage your account and preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-3">
            <div className="space-y-2">
              {SETTING_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                    activeSection === section.id
                      ? "bg-primary/10 text-primary"
                      : "text-text-muted hover:text-text hover:bg-surface-subtle"
                  )}
                >
                  {section.icon}
                  <span className="flex-1 text-left">{section.title}</span>
                  {activeSection === section.id && (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              ))}
            </div>

            {/* Countdown Card */}
            <div className="mt-6">
              <CountdownCard
                examType={preferences.exam_preference}
                isEarlyApplicant={preferences.is_early_applicant}
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-9">
            <Card className="p-8 border-0">
              {/* Account Section */}
              {activeSection === 'account' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-lg font-semibold text-text mb-1">Account</h2>
                    <p className="text-sm text-text-muted">Manage your account information</p>
                  </div>

                  <div className="space-y-6">
                    <SettingItem 
                      label="Username" 
                      description={preferences.last_username_change ? (() => {
                        const lastChange = new Date(preferences.last_username_change);
                        const daysSinceChange = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
                        const daysRemaining = Math.max(0, Math.ceil(14 - daysSinceChange));
                        return daysRemaining > 0 
                          ? `You can change your username in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`
                          : 'You can change your username now';
                      })() : undefined}
                    >
                      <div className="space-y-3">
                        {!isEditingUsername ? (
                          // Default view: Label + Edit button
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-text">
                              {preferences.username || "Not set"}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleStartEdit}
                              disabled={!canEditUsername() || saving === "username"}
                              className={cn(
                                "flex items-center gap-2",
                                !canEditUsername() && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <Edit3 className="w-4 h-4" />
                              <span>Edit</span>
                            </Button>
                          </div>
                        ) : (
                          // Edit mode: Input + Save/Cancel buttons
                          <div className="flex gap-3 items-start">
                            <div className="relative flex-1">
                              <Input
                                ref={usernameInputRef}
                                type="text"
                                value={usernameInput}
                                onChange={handleUsernameChange}
                                placeholder="Enter your username"
                                className={cn(
                                  "pr-10",
                                  usernameAvailability.available === true && "ring-1 ring-success focus:ring-2 focus:ring-success",
                                  usernameAvailability.available === false && "ring-1 ring-error focus:ring-2 focus:ring-error",
                                  usernameError && "ring-1 ring-error focus:ring-2 focus:ring-error"
                                )}
                                disabled={saving === "username"}
                                autoComplete="username"
                              />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {usernameChecking && (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                )}
                                {!usernameChecking && usernameAvailability.available === true && (
                                  <CheckCircle2 className="w-4 h-4 text-success" />
                                )}
                                {!usernameChecking && usernameAvailability.available === false && (
                                  <AlertCircle className="w-4 h-4 text-error" />
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCancelEdit}
                                disabled={saving === "username"}
                                className="p-2"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSaveUsername}
                                disabled={
                                  saving === "username" ||
                                  !isUsernameValid(usernameInput) ||
                                  usernameAvailability.available !== true ||
                                  usernameInput === preferences.username
                                }
                                className={cn(
                                  "p-2",
                                  (isUsernameValid(usernameInput) && usernameAvailability.available === true && usernameInput !== preferences.username)
                                    ? "text-success hover:text-success/80"
                                    : "opacity-30 cursor-not-allowed"
                                )}
                                title="Save"
                              >
                                {saving === "username" ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                        {isEditingUsername && usernameAvailability.message && (
                          <p className={cn(
                            "text-xs",
                            usernameAvailability.available === true ? "text-success" : "text-error"
                          )}>
                            {usernameAvailability.message}
                          </p>
                        )}
                        {usernameError && (
                          <p className="text-xs text-error flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {usernameError}
                          </p>
                        )}
                        {!canEditUsername() && (
                          <p className="text-xs text-error flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            14 days needed between each change
                          </p>
                        )}
                      </div>
                    </SettingItem>

                    <SettingItem 
                      label="Email" 
                      description="Your email address for account recovery"
                    >
                      <div className="flex gap-3">
                        <Input
                          value={email}
                          disabled
                          className="flex-1"
                        />
                        <button
                          onClick={() => setShowChangeEmail(true)}
                          className="px-4 py-2 rounded-xl bg-surface-neutral hover:bg-surface-elevated text-text hover:text-text-muted transition-all font-medium flex items-center gap-2"
                        >
                          <span>Change</span>
                          <Mail className="w-4 h-4" />
                        </button>
                      </div>
                    </SettingItem>

                    <SettingItem 
                      label="Password" 
                      description="Change your account password"
                    >
                      <div className="flex gap-3">
                        <div className="flex-1" />
                        <button
                          onClick={() => setShowChangePassword(true)}
                          className="px-4 py-2 rounded-xl bg-surface-neutral hover:bg-surface-elevated text-text hover:text-text-muted transition-all font-medium flex items-center gap-2"
                        >
                          <span>Change Password</span>
                          <Lock className="w-4 h-4" />
                        </button>
                      </div>
                    </SettingItem>

                    <SettingItem 
                      label="Subscription" 
                      description="Manage your subscription and payment method"
                    >
                      <div className="flex gap-3">
                        <div className="flex-1" />
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch("/api/stripe/create-portal-link", {
                                method: "POST",
                              });
                              const data = await res.json();
                              if (data.url) window.location.href = data.url;
                              else throw new Error(data.error ?? "Failed");
                            } catch (err: unknown) {
                              console.error(err);
                              alert("Failed to open billing portal");
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-surface-neutral hover:bg-surface-elevated text-text hover:text-text-muted transition-all font-medium flex items-center gap-2"
                        >
                          <span>Manage subscription</span>
                          <CreditCard className="w-4 h-4" />
                        </button>
                      </div>
                    </SettingItem>

                    <div className="pt-6">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={handleLogout}
                          className="px-4 py-2.5 rounded-xl bg-surface-neutral hover:bg-surface-elevated text-text hover:text-text-muted transition-all font-medium flex items-center justify-center gap-2"
                        >
                          <span>Logout</span>
                          <LogOut className="w-4 h-4" strokeWidth={2} />
                        </button>

                        <button
                          onClick={() => setShowDeleteAccount(true)}
                          className="px-4 py-2.5 rounded-xl bg-surface-neutral hover:bg-error/20 text-error hover:text-error transition-all font-medium flex items-center justify-center gap-2"
                        >
                          <span>Delete Account</span>
                          <Trash2 className="w-4 h-4" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Exam & Practice Section */}
              {activeSection === 'exam' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-lg font-semibold text-text mb-1">Exam & Practice</h2>
                    <p className="text-sm text-text-muted">Configure your exam type, subjects, and practice behavior</p>
                  </div>

                  <div className="space-y-6">
                    <SettingItem label="Exam Type">
                      <RadioGroup
                        value={preferences.exam_preference || ''}
                        onChange={(value) => {
                          const newPref = value as ExamType;
                          setPreferences((prev) => ({ ...prev, exam_preference: newPref, esat_subjects: [] }));
                          savePreferences({ exam_preference: newPref, esat_subjects: [] }, "exam_preference");
                        }}
                        options={[
                          { value: 'ESAT', label: 'ESAT' },
                          { value: 'TMUA', label: 'TMUA' },
                        ]}
                      />
                    </SettingItem>

                    {preferences.exam_preference === 'ESAT' && (
                      <SettingItem 
                        label="ESAT Subjects" 
                        description={`Select exactly 3 subjects (${localESATSubjects.length}/3 selected)`}
                      >
                        <div className="space-y-2">
                          {ESAT_SUBJECTS.map((subject) => {
                            const isSelected = localESATSubjects.includes(subject);
                            
                            const subjectColor = getSubjectColor(subject);
                            return (
                              <button
                                key={subject}
                                onClick={() => handleESATSubjectToggle(subject)}
                                className={cn(
                                  "w-full px-4 py-2.5 rounded-organic-md transition-all duration-fast ease-signature",
                                  "interaction-scale outline-none focus:outline-none",
                                  "text-sm font-medium flex items-center justify-between",
                                  isSelected
                                    ? `${subjectColor.bg} ${subjectColor.text} ${subjectColor.hover} shadow-lg`
                                    : "bg-white/5 text-white/60 hover:bg-white/10"
                                )}
                              >
                                <span>{subject}</span>
                                {isSelected && (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-4 space-y-2">
                          {localESATSubjects.length !== 3 && (
                            <div className="flex items-center gap-2 text-xs text-warning">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Please select exactly 3 subjects</span>
                            </div>
                          )}
                          <button
                            onClick={handleSaveESATSubjects}
                            disabled={localESATSubjects.length !== 3 || saving === "esat_subjects"}
                            className={cn(
                              "w-full px-5 py-3 rounded-xl transition-all font-medium",
                              localESATSubjects.length === 3 && !saving
                                ? "bg-primary/20 text-primary hover:bg-primary/30 hover:scale-[1.02]"
                                : "bg-white/5 text-white/20 cursor-not-allowed"
                            )}
                          >
                            {saving === "esat_subjects" ? (
                              <div className="flex items-center justify-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                <span>Saving...</span>
                              </div>
                            ) : (
                              <span>Save Subjects</span>
                            )}
                          </button>
                        </div>
                      </SettingItem>
                    )}

                    <div className="pt-6">
                      <SettingItem label="Application Type">
                        <RadioGroup
                          value={preferences.is_early_applicant ? 'early' : 'late'}
                          onChange={(value) => {
                            const isEarly = value === 'early';
                            setPreferences((prev) => ({ ...prev, is_early_applicant: isEarly }));
                            savePreferences({ is_early_applicant: isEarly }, "applicant_type");
                          }}
                          options={[
                            { value: 'early', label: 'Early Applicant' },
                            { value: 'late', label: 'Late Applicant' },
                          ]}
                        />
                      </SettingItem>
                    </div>

                    <div className="pt-6 border-t border-border space-y-6">
                      <div>
                        <h3 className="text-sm font-medium text-text mb-4">Exam Arrangements</h3>
                        <div className="space-y-4">
                          <Toggle
                            checked={preferences.has_extra_time}
                            onChange={(checked) => {
                              setPreferences((prev) => ({ ...prev, has_extra_time: checked }));
                              savePreferences({ has_extra_time: checked }, "extra_time");
                            }}
                            label="Extra Time"
                            description="Standard award: 25% additional time on top of normal test duration"
                          />

                          {preferences.has_extra_time && (
                            <div className="ml-14 space-y-3">
                              <SettingItem label="Extra Time Percentage">
                                <div className="flex gap-3 items-center">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={preferences.extra_time_percentage}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value) || 25;
                                      setPreferences((prev) => ({ ...prev, extra_time_percentage: value }));
                                    }}
                                    onBlur={() => savePreferences({ extra_time_percentage: preferences.extra_time_percentage }, "extra_time_percentage")}
                                    className="w-24"
                                  />
                                  <span className="text-sm text-text-muted">%</span>
                                </div>
                              </SettingItem>
                              {getTimeWithExtraTime() && (
                                <div className="text-xs text-text-muted bg-surface-subtle p-3 rounded-lg">
                                  {preferences.exam_preference === 'TMUA' 
                                    ? `TMUA: ~${getTimeWithExtraTime()} with +${preferences.extra_time_percentage}%`
                                    : `ESAT: ~${getTimeWithExtraTime()} per module with +${preferences.extra_time_percentage}%`
                                  }
                                </div>
                              )}
                            </div>
                          )}

                          <Toggle
                            checked={preferences.has_rest_breaks}
                            onChange={(checked) => {
                              setPreferences((prev) => ({ ...prev, has_rest_breaks: checked }));
                              savePreferences({ has_rest_breaks: checked }, "rest_breaks");
                            }}
                            label="Rest Breaks"
                            description='Request rest breaks / "pause-the-clock" breaks during the exam'
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Management Section */}
              {activeSection === 'data' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-lg font-semibold text-text mb-1">Data Management</h2>
                    <p className="text-sm text-text-muted">Export or reset your practice data</p>
                  </div>

                  <div className="space-y-6">
                    <SettingItem 
                      label="Export Data" 
                      description="Download all your sessions, attempts, and progress data as CSV"
                    >
                      <Button
                        variant="secondary"
                        onClick={handleExportData}
                        className="flex items-center gap-2"
                      >
                        <span>Export Results (CSV)</span>
                        <Download className="w-4 h-4" />
                      </Button>
                    </SettingItem>

                    <div className="pt-6">
                      <SettingItem 
                        label="Reset All Data" 
                        description="Permanently delete all your sessions, attempts, and progress. This cannot be undone."
                      >
                        <Button
                          variant="danger"
                          onClick={() => setShowResetData(true)}
                          className="flex items-center gap-2"
                        >
                          <span>Reset All Data</span>
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </SettingItem>
                    </div>
                  </div>
                </div>
              )}

              {/* Appearance Section */}
              {activeSection === 'appearance' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-lg font-semibold text-text mb-1">Appearance</h2>
                    <p className="text-sm text-text-muted">Customize the visual appearance of the app</p>
                  </div>

                  <div className="space-y-6">
                    <SettingItem label="Font Size">
                      <RadioGroup
                        value={preferences.font_size}
                        onChange={(value) => {
                          const size = value as 'small' | 'medium' | 'large';
                          setPreferences((prev) => ({ ...prev, font_size: size }));
                          savePreferences({ font_size: size }, "font_size");
                        }}
                        options={[
                          { value: 'small', label: 'Small' },
                          { value: 'medium', label: 'Medium' },
                          { value: 'large', label: 'Large' },
                        ]}
                      />
                    </SettingItem>

                    <Toggle
                      checked={preferences.reduced_motion}
                      onChange={(checked) => {
                        setPreferences((prev) => ({ ...prev, reduced_motion: checked }));
                        savePreferences({ reduced_motion: checked }, "reduced_motion");
                      }}
                      label="Reduced Motion"
                      description="Reduce animations for better accessibility"
                    />

                    <SettingItem 
                      label="Theme" 
                      description={`Currently using ${isDark ? 'dark' : 'light'} mode`}
                    >
                      <button
                        onClick={toggleTheme}
                        className={cn(
                          "flex items-center gap-2 px-4 py-3 rounded-lg transition-all",
                          "bg-white/5 hover:bg-white/10",
                          "text-text hover:text-text-muted"
                        )}
                      >
                        {isDark ? (
                          <>
                            <span className="text-sm font-medium">Switch to Light Mode</span>
                            <Sun className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            <span className="text-sm font-medium">Switch to Dark Mode</span>
                            <Moon className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </SettingItem>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      <DeleteAccountModal
        isOpen={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
        onConfirm={handleDeleteAccount}
      />
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        onConfirm={handleChangePassword}
      />
      <ChangeEmailModal
        isOpen={showChangeEmail}
        onClose={() => setShowChangeEmail(false)}
        currentEmail={email}
        onConfirm={handleChangeEmail}
      />
      <ResetDataModal
        isOpen={showResetData}
        onClose={() => setShowResetData(false)}
        onConfirm={handleResetData}
      />
      <UsernameSetupModal
        isOpen={showUsernameSetup}
        onComplete={() => {
          setShowUsernameSetup(false);
          // Reload preferences
          window.location.reload();
        }}
      />
    </Container>
  );
}
