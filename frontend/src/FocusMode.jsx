import { useEffect, useState } from "react";
import FocusAnalytics from "./FocusAnalytics";

import {
  Clock3,
  Play,
  Pause,
  RotateCcw,
  X,
  CheckCircle2,
} from "lucide-react";

import "./FocusMode.css";

const STORAGE_KEY = "remindme_focus_sessions";

const getSavedSessions = () => {
  try {
    const sessions = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    return Array.isArray(sessions) ? sessions : [];
  } catch {
    return [];
  }
};

const formatTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
};

export default function FocusMode({ task }) {
  const [isOpen, setIsOpen] = useState(false);

  const [durationMinutes, setDurationMinutes] = useState(25);

  const [remainingSeconds, setRemainingSeconds] = useState(
    25 * 60
  );

  const [isRunning, setIsRunning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const [lastSession, setLastSession] = useState(null);

  const durationSeconds = durationMinutes * 60;

  const progress =
    durationSeconds > 0
      ? ((durationSeconds - remainingSeconds) /
          durationSeconds) *
        100
      : 0;

  // Countdown timer
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setRemainingSeconds((current) =>
        Math.max(current - 1, 0)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  // Save a session when the countdown reaches zero
  useEffect(() => {
    if (!isRunning || remainingSeconds !== 0) return;

    setIsRunning(false);
    setCompleted(true);

    const session = {
      id: `${Date.now()}-${task.id}`,
      reminderId: task.id,
      reminderTitle: task.title,
      durationMinutes,
      completedAt: new Date().toISOString(),
    };

    try {
      const previousSessions = getSavedSessions();

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          [session, ...previousSessions].slice(0, 50)
        )
      );
    } catch (error) {
      console.error(
        "Unable to save focus session:",
        error
      );
    }

    setLastSession(session);

    // Notify Focus Analytics that a new session was completed
    window.dispatchEvent(
      new Event("remindme:focus-session-saved")
    );
  }, [
    isRunning,
    remainingSeconds,
    durationMinutes,
    task.id,
    task.title,
  ]);

  // Change focus duration
  const handleDurationChange = (event) => {
    const minutes = Number(event.target.value);

    setDurationMinutes(minutes);
    setRemainingSeconds(minutes * 60);
    setCompleted(false);
    setLastSession(null);
  };

  // Start or resume timer
  const startTimer = () => {
    if (completed || remainingSeconds === 0) {
      setRemainingSeconds(durationSeconds);
      setCompleted(false);
      setLastSession(null);
    }

    setIsRunning(true);
  };

  // Pause timer
  const pauseTimer = () => {
    setIsRunning(false);
  };

  // Reset timer
  const resetTimer = () => {
    setIsRunning(false);
    setRemainingSeconds(durationSeconds);
    setCompleted(false);
    setLastSession(null);
  };

  // Close Focus Mode
  const closeFocusMode = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Focus Mode button */}
      <button
        type="button"
        className="focus-mode-trigger"
        onClick={() => setIsOpen(true)}
      >
        <Clock3 size={16} />
        Focus Mode
      </button>

      {/* Focus Mode modal */}
      {isOpen && (
        <div
          className="focus-overlay"
          onClick={closeFocusMode}
        >
          <section
            className="focus-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="focus-heading"
          >
            {/* Header */}
            <div className="focus-header">
              <div>
                <span className="focus-eyebrow">
                  REMINDME FOCUS
                </span>

                <h2 id="focus-heading">
                  Stay focused.
                </h2>
              </div>

              <button
                type="button"
                className="focus-close"
                onClick={closeFocusMode}
                aria-label="Close focus mode"
              >
                <X size={19} />
              </button>
            </div>

            {/* Current reminder */}
            <div className="focus-task">
              <span>WORKING ON</span>

              <h3>
                {task.title || "Untitled reminder"}
              </h3>
            </div>

            {/* Duration selector */}
            {!completed && (
              <div className="focus-duration">
                <label htmlFor="focus-duration">
                  Focus duration
                </label>

                <select
                  id="focus-duration"
                  value={durationMinutes}
                  onChange={handleDurationChange}
                  disabled={isRunning}
                >
                  <option value={15}>15 minutes</option>
                  <option value={25}>25 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>
            )}

            {/* Session completed screen */}
            {completed ? (
              <div className="focus-complete">
                <CheckCircle2
                  size={55}
                  className="focus-success-icon"
                />

                <h2>Session completed!</h2>

                <p>
                  Great work! You stayed focused for{" "}
                  <strong>
                    {lastSession?.durationMinutes ||
                      durationMinutes}{" "}
                    minutes
                  </strong>.
                </p>

                <p className="focus-summary-title">
                  {task.title}
                </p>

                <button
                  type="button"
                  className="focus-primary-button"
                  onClick={resetTimer}
                >
                  <RotateCcw size={16} />
                  Start another session
                </button>
              </div>
            ) : (
              <>
                {/* Circular countdown timer */}
                <div
                  className="focus-timer-ring"
                  style={{
                    "--focus-progress": `${progress}%`,
                  }}
                >
                  <div className="focus-timer-inner">
                    <span className="focus-timer">
                      {formatTime(remainingSeconds)}
                    </span>

                    <span className="focus-timer-label">
                      {isRunning ? "FOCUSING" : "READY"}
                    </span>
                  </div>
                </div>

                {/* Progress */}
                <div className="focus-progress-text">
                  {Math.round(progress)}% completed
                </div>

                {/* Timer controls */}
                <div className="focus-controls">
                  {isRunning ? (
                    <button
                      type="button"
                      className="focus-primary-button"
                      onClick={pauseTimer}
                    >
                      <Pause size={17} />
                      Pause
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="focus-primary-button"
                      onClick={startTimer}
                    >
                      <Play size={17} />

                      {remainingSeconds === durationSeconds
                        ? "Start focusing"
                        : "Resume"}
                    </button>
                  )}

                  <button
                    type="button"
                    className="focus-reset-button"
                    onClick={resetTimer}
                    title="Reset timer"
                    aria-label="Reset timer"
                  >
                    <RotateCcw size={17} />
                  </button>
                </div>

                <p className="focus-tip">
                  Stay focused on one task. You've got this!
                </p>
              </>
            )}

            {/* Focus Analytics - inside the modal */}
            <FocusAnalytics />

          </section>
        </div>
      )}
    </>
  );
}