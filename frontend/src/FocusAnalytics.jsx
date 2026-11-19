import { useEffect, useState } from "react";
import {
  Clock,
  Target,
  Flame,
  TrendingUp,
} from "lucide-react";

import "./FocusAnalytics.css";

const STORAGE_KEY = "remindme_focus_sessions";

function getSessions() {
  try {
    const data = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function FocusAnalytics() {
  const [sessions, setSessions] = useState([]);

  const loadSessions = () => {
    setSessions(getSessions());
  };

  useEffect(() => {
    loadSessions();

    window.addEventListener(
      "remindme:focus-session-saved",
      loadSessions
    );

    window.addEventListener("storage", loadSessions);

    return () => {
      window.removeEventListener(
        "remindme:focus-session-saved",
        loadSessions
      );

      window.removeEventListener("storage", loadSessions);
    };
  }, []);

  const validSessions = sessions.filter((session) => {
    return (
      session &&
      Number.isFinite(Number(session.durationMinutes)) &&
      Number(session.durationMinutes) > 0 &&
      !Number.isNaN(new Date(session.completedAt).getTime())
    );
  });

  const totalSessions = validSessions.length;

  const totalMinutes = validSessions.reduce(
    (total, session) =>
      total + Number(session.durationMinutes),
    0
  );

  const todayKey = getDateKey(new Date());

  const todayMinutes = validSessions
    .filter(
      (session) =>
        getDateKey(new Date(session.completedAt)) === todayKey
    )
    .reduce(
      (total, session) =>
        total + Number(session.durationMinutes),
      0
    );

  // Prepare the last 7 days of activity
  const weeklyActivity = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);

    const dateKey = getDateKey(date);

    const minutes = validSessions
      .filter(
        (session) =>
          getDateKey(new Date(session.completedAt)) === dateKey
      )
      .reduce(
        (total, session) =>
          total + Number(session.durationMinutes),
        0
      );

    weeklyActivity.push({
      label: date.toLocaleDateString("en", {
        weekday: "short",
      }),
      minutes,
    });
  }

  const maximumMinutes = Math.max(
    ...weeklyActivity.map((day) => day.minutes),
    1
  );

  const recentSessions = [...validSessions]
    .sort(
      (a, b) =>
        new Date(b.completedAt) - new Date(a.completedAt)
    )
    .slice(0, 5);

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;

    if (hours === 0) return `${remaining} min`;
    if (remaining === 0) return `${hours} hr`;

    return `${hours} hr ${remaining} min`;
  };

  return (
    <details className="focus-analytics">
      <summary className="focus-analytics-heading">
        <span>
          <TrendingUp size={17} />
          Focus Analytics
        </span>

        <span className="focus-analytics-view">
          View statistics
        </span>
      </summary>

      <div className="focus-analytics-content">
        <div className="focus-stat-grid">
          <div className="focus-stat-card">
            <Target size={19} />

            <span>Sessions</span>

            <strong>{totalSessions}</strong>
          </div>

          <div className="focus-stat-card">
            <Clock size={19} />

            <span>Total focus time</span>

            <strong>{formatDuration(totalMinutes)}</strong>
          </div>

          <div className="focus-stat-card">
            <Flame size={19} />

            <span>Today</span>

            <strong>{formatDuration(todayMinutes)}</strong>
          </div>
        </div>

        <div className="focus-weekly-chart">
          <h3>Last 7 days</h3>

          <div className="focus-chart-bars">
            {weeklyActivity.map((day, index) => (
              <div className="focus-chart-column" key={index}>
                <span className="focus-chart-value">
                  {day.minutes > 0 ? day.minutes : ""}
                </span>

                <div className="focus-chart-bar-area">
                  <div
                    className="focus-chart-bar"
                    style={{
                      height: `${
                        day.minutes > 0
                          ? Math.max(
                              (day.minutes / maximumMinutes) * 100,
                              8
                            )
                          : 3
                      }%`,
                      opacity: day.minutes > 0 ? 1 : 0.3,
                    }}
                  />
                </div>

                <span className="focus-chart-label">
                  {day.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="focus-recent-sessions">
          <h3>Recent sessions</h3>

          {recentSessions.length === 0 ? (
            <p className="focus-no-sessions">
              Complete your first focus session to see your history.
            </p>
          ) : (
            recentSessions.map((session) => (
              <div
                className="focus-history-item"
                key={session.id}
              >
                <div className="focus-history-icon">
                  <Target size={16} />
                </div>

                <div className="focus-history-details">
                  <strong>
                    {session.reminderTitle || "Focus session"}
                  </strong>

                  <span>
                    {new Date(
                      session.completedAt
                    ).toLocaleString()}
                  </span>
                </div>

                <span className="focus-history-duration">
                  {session.durationMinutes} min
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </details>
  );
}