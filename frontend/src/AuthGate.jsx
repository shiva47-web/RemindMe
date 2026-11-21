
import { useEffect, useRef, useState } from "react";

import {
  ArrowRight,
  CalendarDays,
  Clock,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  MoreVertical,
  UserRound,
  Settings,
  Bell,
  LogOut,
  X,
  Mail,
  Check,
} from "lucide-react";

import "./AuthGate.css";

const API_URL = "https://remindme-api-6sfw.onrender.com";
const TOKEN_KEY = "remindme_access_token";
const USER_KEY = "remindme_user";
const NOTIFICATION_PREF_KEY = "remindme_notification_preferences";

function safeArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function accountKeys(userId) {
  const id = String(userId);

  return {
    tasks: `remindme_tasks_user_${id}`,
    notified: `remindme_notified_ids_user_${id}`,
    occurrences: `remindme_notified_occurrences_user_${id}`,
  };
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map((item) => item.msg).join(", ")
      : data.detail;

    const error = new Error(
      detail || `Request failed (${response.status})`
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

// LOAD AND RECOVER ACCOUNT WORKSPACE
async function loadAccountWorkspace(user, token) {
  const response = await fetch(`${API_URL}/api/reminders`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await readResponse(response);

  let reminders = Array.isArray(result.reminders)
    ? result.reminders
    : [];

  const keys = accountKeys(user.id);

  // Read reminders previously saved for this account.
  const cachedReminders = safeArray(keys.tasks);

  // If the server has no reminders, recover this account's cache.
  if (reminders.length === 0 && cachedReminders.length > 0) {
    console.log(
      "Recovering reminders from this account's local cache..."
    );

    try {
      const syncResponse = await fetch(
        `${API_URL}/api/reminders/sync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            timezone:
              Intl.DateTimeFormat().resolvedOptions().timeZone ||
              "Asia/Kolkata",
            reminders: cachedReminders,
          }),
        }
      );

      await readResponse(syncResponse);

      reminders = cachedReminders;

      console.log(
        "Previous reminders recovered and synced successfully."
      );
    } catch (syncError) {
      // Keep recovered reminders available locally if sync fails.
      console.error(
        "Reminder recovery sync failed:",
        syncError
      );

      reminders = cachedReminders;
    }
  }

  // Save the final reminder list.
  localStorage.setItem(keys.tasks, JSON.stringify(reminders));
  localStorage.setItem("remindme_tasks", JSON.stringify(reminders));

  if (localStorage.getItem(keys.notified) === null) {
    const oldIds =
      String(user.id) === "1"
        ? safeArray("remindme_notified_ids")
        : [];

    localStorage.setItem(keys.notified, JSON.stringify(oldIds));
  }

  if (localStorage.getItem(keys.occurrences) === null) {
    const oldOccurrences =
      String(user.id) === "1"
        ? safeArray("remindme_notified_occurrences")
        : [];

    localStorage.setItem(
      keys.occurrences,
      JSON.stringify(oldOccurrences)
    );
  }

  localStorage.setItem(
    "remindme_notified_ids",
    localStorage.getItem(keys.notified) || "[]"
  );

  localStorage.setItem(
    "remindme_notified_occurrences",
    localStorage.getItem(keys.occurrences) || "[]"
  );

  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// SAVE CURRENT ACCOUNT CACHE
function saveCurrentAccountCache(user) {
  if (!user?.id) return;

  const keys = accountKeys(user.id);

  localStorage.setItem(
    keys.tasks,
    JSON.stringify(safeArray("remindme_tasks"))
  );

  localStorage.setItem(
    keys.notified,
    JSON.stringify(safeArray("remindme_notified_ids"))
  );

  localStorage.setItem(
    keys.occurrences,
    JSON.stringify(safeArray("remindme_notified_occurrences"))
  );
}

function getInitialNotificationPreferences() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(NOTIFICATION_PREF_KEY) || "{}"
    );

    return {
      browserNotifications: saved.browserNotifications ?? false,
      reminderAlerts: saved.reminderAlerts ?? true,
    };
  } catch {
    return {
      browserNotifications: false,
      reminderAlerts: true,
    };
  }
}

export default function AuthGate({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Profile menu and account panels
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState("");
  const menuRef = useRef(null);

  // Notification preferences
  const [notificationPreferences, setNotificationPreferences] =
    useState(getInitialNotificationPreferences);

  useEffect(() => {
    localStorage.setItem(
      NOTIFICATION_PREF_KEY,
      JSON.stringify(notificationPreferences)
    );
  }, [notificationPreferences]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  // RESTORE LOGIN SESSION
  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const token = localStorage.getItem(TOKEN_KEY);

      if (!token) {
        if (active) setCheckingSession(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await readResponse(response);

        await loadAccountWorkspace(result.user, token);

        if (active) {
          setCurrentUser(result.user);
        }
      } catch (err) {
        if (err.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);

          if (active) {
            setError(
              "Your session expired. Please sign in again."
            );
          }
        } else if (active) {
          setError(
            `Could not load your workspace: ${err.message}`
          );
        }
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  // LOGIN AND REGISTRATION
  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "login" : "register";

      const body =
        mode === "login"
          ? {
              email: email.trim(),
              password,
            }
          : {
              full_name: fullName.trim(),
              email: email.trim(),
              password,
            };

      const response = await fetch(
        `${API_URL}/api/auth/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const result = await readResponse(response);

      localStorage.setItem(TOKEN_KEY, result.access_token);

      try {
        await loadAccountWorkspace(
          result.user,
          result.access_token
        );
      } catch (workspaceError) {
        localStorage.removeItem(TOKEN_KEY);

        throw new Error(
          `Your account is valid, but reminders could not be loaded: ${workspaceError.message}`
        );
      }

      setCurrentUser(result.user);
      setPassword("");
    } catch (err) {
      setError(
        err.message || "Unable to continue. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  
  // LOGOUT - SAVE REMINDERS BEFORE CLEARING SESSION
  async function handleLogout() {
    const token = localStorage.getItem(TOKEN_KEY);

    // Save a local backup for this account first.
    saveCurrentAccountCache(currentUser);

    // Read the latest reminders from local storage.
    const latestReminders = safeArray("remindme_tasks");

    // Sync the latest reminders to PostgreSQL before logout.
    if (token && currentUser?.id) {
      try {
        const response = await fetch(
          `${API_URL}/api/reminders/sync`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              timezone:
                Intl.DateTimeFormat().resolvedOptions().timeZone ||
                "Asia/Kolkata",
              reminders: latestReminders,
            }),
          }
        );

        await readResponse(response);

        console.log(
          "RemindMe: reminders safely synced before logout."
        );

        // Update the account-specific backup after successful sync.
        const keys = accountKeys(currentUser.id);

        localStorage.setItem(
          keys.tasks,
          JSON.stringify(latestReminders)
        );
      } catch (syncError) {
        console.error(
          "Logout sync failed. Keeping local backup:",
          syncError
        );
      }
    }

    // Clear login session only after attempting the sync.
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("remindme_tasks");
    localStorage.removeItem("remindme_notified_ids");
    localStorage.removeItem("remindme_notified_occurrences");

    setCurrentUser(null);
    setPassword("");
    setError("");
    setMode("login");
    setMenuOpen(false);
    setActivePanel("");
  }


  function openPanel(panel) {
    setMenuOpen(false);
    setActivePanel(panel);
  }

  // BROWSER NOTIFICATIONS
  async function toggleBrowserNotifications() {
    if (notificationPreferences.browserNotifications) {
      setNotificationPreferences((previous) => ({
        ...previous,
        browserNotifications: false,
      }));
      return;
    }

    if (!("Notification" in window)) {
      alert("Your browser does not support notifications.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        setNotificationPreferences((previous) => ({
          ...previous,
          browserNotifications: true,
        }));
      } else {
        setNotificationPreferences((previous) => ({
          ...previous,
          browserNotifications: false,
        }));

        alert(
          "Notification permission was not granted. You can enable it in your browser settings."
        );
      }
    } catch {
      alert("Could not enable browser notifications.");
    }
  }

  // LOADING SCREEN
  if (checkingSession) {
    return (
      <div className="auth-loading">
        <Clock size={30} />
        <p>Preparing your workspace...</p>
      </div>
    );
  }

  // AUTHENTICATED DASHBOARD
  if (currentUser) {
    const displayName =
      currentUser.full_name ||
      currentUser.name ||
      currentUser.username ||
      "User";

    const displayEmail = currentUser.email || "Email unavailable";

    const avatarLetter = displayName.charAt(0).toUpperCase();

    return (
      <div className="authenticated-shell">
        <div className="auth-session-bar">
          <div className="auth-session-user">
            <div className="auth-avatar">
              {avatarLetter}
            </div>

            <div className="auth-session-user-info">
              <strong>{displayName}</strong>
              <span>{displayEmail}</span>
            </div>
          </div>

          <div className="auth-profile-menu" ref={menuRef}>
            <button
              type="button"
              className="auth-menu-trigger"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="Open account menu"
              aria-expanded={menuOpen}
              title="Account menu"
            >
              <MoreVertical size={22} />
            </button>

            {menuOpen && (
              <div className="auth-dropdown-menu">
                <div className="auth-dropdown-heading">
                  <strong>{displayName}</strong>
                  <span>{displayEmail}</span>
                </div>

                <button
                  type="button"
                  onClick={() => openPanel("profile")}
                >
                  <UserRound size={17} />
                  <span>View Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => openPanel("settings")}
                >
                  <Settings size={17} />
                  <span>Account Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => openPanel("notifications")}
                >
                  <Bell size={17} />
                  <span>Notification Preferences</span>
                </button>

                <div className="auth-dropdown-divider" />

                <button
                  type="button"
                  className="auth-dropdown-logout"
                  onClick={handleLogout}
                >
                  <LogOut size={17} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {children}

        {/* ACCOUNT PANELS */}
        {activePanel && (
          <div
            className="auth-panel-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setActivePanel("");
              }
            }}
          >
            <section
              className="auth-account-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="auth-panel-title"
            >
              <div className="auth-panel-header">
                <div>
                  <span className="auth-panel-eyebrow">
                    REMINDME ACCOUNT
                  </span>

                  <h2 id="auth-panel-title">
                    {activePanel === "profile"
                      ? "Your Profile"
                      : activePanel === "settings"
                        ? "Account Settings"
                        : "Notification Preferences"}
                  </h2>
                </div>

                <button
                  type="button"
                  className="auth-panel-close"
                  onClick={() => setActivePanel("")}
                  aria-label="Close panel"
                >
                  <X size={20} />
                </button>
              </div>

              {activePanel === "profile" && (
                <div className="auth-profile-content">
                  <div className="auth-profile-large-avatar">
                    {avatarLetter}
                  </div>

                  <h3>{displayName}</h3>
                  <p className="auth-profile-subtitle">
                    Your personal RemindMe account
                  </p>

                  <div className="auth-profile-detail">
                    <UserRound size={19} />
                    <div>
                      <span>Full name</span>
                      <strong>{displayName}</strong>
                    </div>
                  </div>

                  <div className="auth-profile-detail">
                    <Mail size={19} />
                    <div>
                      <span>Email address</span>
                      <strong>{displayEmail}</strong>
                    </div>
                  </div>

                  <div className="auth-profile-detail">
                    <ShieldCheck size={19} />
                    <div>
                      <span>Account status</span>
                      <strong>Signed in</strong>
                    </div>
                  </div>
                </div>
              )}

              {activePanel === "settings" && (
                <div className="auth-settings-content">
                  <div className="auth-settings-intro">
                    <Settings size={22} />
                    <div>
                      <strong>Your account information</strong>
                      <p>
                        These details are currently provided by your
                        RemindMe account.
                      </p>
                    </div>
                  </div>

                  <div className="auth-settings-field">
                    <label>Full name</label>
                    <input
                      type="text"
                      value={displayName}
                      readOnly
                    />
                  </div>

                  <div className="auth-settings-field">
                    <label>Email address</label>
                    <input
                      type="email"
                      value={displayEmail}
                      readOnly
                    />
                  </div>

                  <p className="auth-settings-note">
                    Profile editing is not connected to your backend
                    yet. Your existing account details are unchanged.
                  </p>
                </div>
              )}

              {activePanel === "notifications" && (
                <div className="auth-notification-content">
                  <div className="auth-notification-option">
                    <div className="auth-notification-option-info">
                      <div className="auth-option-icon">
                        <Bell size={19} />
                      </div>

                      <div>
                        <strong>Browser notifications</strong>
                        <p>
                          Allow RemindMe to send browser notifications.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`auth-toggle ${
                        notificationPreferences.browserNotifications
                          ? "active"
                          : ""
                      }`}
                      onClick={toggleBrowserNotifications}
                      role="switch"
                      aria-checked={
                        notificationPreferences.browserNotifications
                      }
                      aria-label="Toggle browser notifications"
                    >
                      <span />
                    </button>
                  </div>

                  <div className="auth-notification-option">
                    <div className="auth-notification-option-info">
                      <div className="auth-option-icon">
                        <Clock size={19} />
                      </div>

                      <div>
                        <strong>Reminder alerts</strong>
                        <p>
                          Keep reminder alerts enabled in your
                          preferences.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`auth-toggle ${
                        notificationPreferences.reminderAlerts
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setNotificationPreferences((previous) => ({
                          ...previous,
                          reminderAlerts: !previous.reminderAlerts,
                        }))
                      }
                      role="switch"
                      aria-checked={
                        notificationPreferences.reminderAlerts
                      }
                      aria-label="Toggle reminder alerts"
                    >
                      <span />
                    </button>
                  </div>

                  <p className="auth-settings-note">
                    Your preferences are saved in this browser.
                    Browser permission is also controlled by your
                    browser settings.
                  </p>
                </div>
              )}

              <div className="auth-panel-footer">
                <button
                  type="button"
                  onClick={() => setActivePanel("")}
                >
                  <Check size={17} />
                  Done
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    );
  }

  // LOGIN / REGISTRATION PAGE
  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <Clock size={23} />
          </div>

          <span>
            Remind<span className="brand-highlight">Me.</span>
          </span>
        </div>

        <div className="auth-brand-content">
          <div className="auth-eyebrow">
            <Sparkles size={16} />
            A LITTLE MORE CLARITY, EVERY DAY
          </div>

          <h1>
            Make room for
            <br />
            <span>what matters.</span>
          </h1>

          <p>
            All the little things you don't want to forget,
            gathered in one feel-good space.
          </p>

          <div className="auth-feature">
            <CalendarDays size={19} />
            A gentler way to plan your day.
          </div>

          <div className="auth-feature">
            <ShieldCheck size={19} />
            Your own personal workspace.
          </div>
        </div>

        <div className="auth-brand-footer">
          REMEMBER LESS. LIVE MORE.
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-container">
          <div className="auth-mobile-brand">
            <Clock size={22} />
            RemindMe.
          </div>

          <div className="auth-form-heading">
            <span>
              {mode === "login" ? "WELCOME BACK" : "GET STARTED"}
            </span>

            <h2>
              {mode === "login"
                ? "Let's pick up where you left off."
                : "Create a little more calm."}
            </h2>

            <p>
              {mode === "login"
                ? "Sign in to see what's on your mind today."
                : "Your more organized days start here."}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "register" && (
              <div className="auth-field">
                <label htmlFor="auth-full-name">Your name</label>

                <input
                  id="auth-full-name"
                  type="text"
                  placeholder="How should we call you?"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  maxLength={100}
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="auth-email">Email address</label>

              <input
                id="auth-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                autoComplete="email"
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>

              <div className="auth-password-wrapper">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    mode === "register"
                      ? "At least 8 characters"
                      : "Enter your password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  minLength={8}
                  maxLength={128}
                  autoComplete={
                    mode === "login"
                      ? "current-password"
                      : "new-password"
                  }
                  required
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((value) => !value)
                  }
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <button
              className="auth-submit-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Opening your workspace..."
                : mode === "login"
                  ? "Sign in to RemindMe"
                  : "Create my account"}

              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="auth-mode-switch">
            <span>
              {mode === "login"
                ? "New around here?"
                : "Already have an account?"}
            </span>

            <button
              type="button"
              onClick={() => {
                setMode(
                  mode === "login" ? "register" : "login"
                );

                setError("");
                setPassword("");
              }}
            >
              {mode === "login"
                ? "Create an account"
                : "Sign in instead"}
            </button>
          </div>

          <div className="auth-security-note">
            <ShieldCheck size={15} />
            Your reminders stay in your personal account.
          </div>
        </div>
      </section>
    </main>
  );
}
