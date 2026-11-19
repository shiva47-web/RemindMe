import { useEffect, useRef } from "react";

const API_URL = "http://127.0.0.1:8000";

const TOKEN_KEY = "remindme_access_token";

export default function ReminderSync() {
  const lastSynced = useRef({
    token: "",
    payload: "",
  });

  const blockedToken = useRef("");
  const syncRunning = useRef(false);

  useEffect(() => {
    let active = true;

    const syncReminders = async () => {
      // Prevent overlapping synchronization requests.
      if (syncRunning.current) {
        return;
      }

      // Read the latest login token.
      const token = localStorage.getItem(TOKEN_KEY);

      // Do not synchronize until the user logs in.
      if (!token) {
        lastSynced.current = {
          token: "",
          payload: "",
        };

        return;
      }

      // Avoid repeatedly sending requests with an invalid token.
      if (blockedToken.current === token) {
        return;
      }

      syncRunning.current = true;

      try {
        const saved =
          localStorage.getItem("remindme_tasks") || "[]";

        const reminders = JSON.parse(saved);

        if (!Array.isArray(reminders)) {
          throw new Error("Invalid reminder data.");
        }

        const timezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          "Asia/Kolkata";

        const payload = JSON.stringify({
          timezone,
          reminders,
        });

        // Skip unchanged data for the same login session.
        if (
          lastSynced.current.token === token &&
          lastSynced.current.payload === payload
        ) {
          return;
        }

        const response = await fetch(
          `${API_URL}/api/reminders/sync`,
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },

            body: payload,
          }
        );

        const result = await response.json();

        if (response.status === 401) {
          blockedToken.current = token;

          console.warn(
            "RemindMe session expired. Please log in again."
          );

          return;
        }

        if (!response.ok) {
          throw new Error(
            result.detail ||
              "Reminder synchronization failed."
          );
        }

        if (active) {
          // A successful login token may now synchronize.
          blockedToken.current = "";

          lastSynced.current = {
            token,
            payload,
          };

          console.log(
            "RemindMe reminders synchronized:",
            result.count
          );
        }
      } catch (error) {
        console.error(
          "RemindMe sync error:",
          error.message
        );
      } finally {
        syncRunning.current = false;
      }
    };

    // Sync immediately.
    syncReminders();

    // Check for changes every five seconds.
    const interval = setInterval(
      syncReminders,
      5000
    );

    window.addEventListener("focus", syncReminders);

    return () => {
      active = false;

      clearInterval(interval);

      window.removeEventListener(
        "focus",
        syncReminders
      );
    };
  }, []);

  return null;
}