import { useEffect, useState } from "react";

import {
  ArrowRight,
  CalendarDays,
  Clock,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import "./AuthGate.css";

const API_URL = "http://127.0.0.1:8001";
const TOKEN_KEY = "remindme_access_token";
const USER_KEY = "remindme_user";

function safeArray(key) {
  try {
    const value = JSON.parse(
      localStorage.getItem(key) || "[]"
    );

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


// LOAD ACCOUNT REMINDERS FROM POSTGRESQL

async function loadAccountWorkspace(user, token) {

  const response = await fetch(
    `${API_URL}/api/reminders`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const result = await readResponse(response);

  const reminders = Array.isArray(result.reminders)
    ? result.reminders
    : [];

  const keys = accountKeys(user.id);

  // Save reminders separately for each account.

  localStorage.setItem(
    keys.tasks,
    JSON.stringify(reminders)
  );

  // Load reminders into the existing dashboard.

  localStorage.setItem(
    "remindme_tasks",
    JSON.stringify(reminders)
  );

  // Keep notification history separate per user.

  if (localStorage.getItem(keys.notified) === null) {

    const oldIds =
      String(user.id) === "1"
        ? safeArray("remindme_notified_ids")
        : [];

    localStorage.setItem(
      keys.notified,
      JSON.stringify(oldIds)
    );
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

  localStorage.setItem(
    USER_KEY,
    JSON.stringify(user)
  );
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
    JSON.stringify(
      safeArray("remindme_notified_occurrences")
    )
  );
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

        const response = await fetch(
          `${API_URL}/api/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

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

      const endpoint =
        mode === "login"
          ? "login"
          : "register";

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

      localStorage.setItem(
        TOKEN_KEY,
        result.access_token
      );

      // Retrieve this user's database reminders.

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


  // LOGOUT

  function handleLogout() {

    saveCurrentAccountCache(currentUser);

    localStorage.removeItem(TOKEN_KEY);

    localStorage.removeItem(USER_KEY);

    localStorage.removeItem("remindme_tasks");

    localStorage.removeItem("remindme_notified_ids");

    localStorage.removeItem(
      "remindme_notified_occurrences"
    );

    setCurrentUser(null);

    setPassword("");

    setError("");

    setMode("login");
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

    return (
      <div className="authenticated-shell">

        <div className="auth-session-bar">

          <div className="auth-session-user">

            <div className="auth-avatar">
              {(currentUser.full_name || "U")
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <strong>{currentUser.full_name}</strong>
              <span>{currentUser.email}</span>
            </div>

          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="auth-logout-button"
          >
            Log out
          </button>

        </div>

        {children}

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
              {mode === "login"
                ? "WELCOME BACK"
                : "GET STARTED"}
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


          <form
            className="auth-form"
            onSubmit={handleSubmit}
          >

            {mode === "register" && (

              <div className="auth-field">

                <label htmlFor="auth-full-name">
                  Your name
                </label>

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

              <label htmlFor="auth-email">
                Email address
              </label>

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

              <label htmlFor="auth-password">
                Password
              </label>

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
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword
                    ? <EyeOff size={18} />
                    : <Eye size={18} />}
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
                  mode === "login"
                    ? "register"
                    : "login"
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