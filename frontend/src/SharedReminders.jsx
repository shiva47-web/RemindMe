import { useEffect, useState } from "react";
import {
  Users,
  Clock,
  CalendarDays,
  Pencil,
  Check,
  X,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

import { sharingRequest } from "./sharingApi";
import "./SharedReminders.css";

export default function SharedReminders() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  async function loadReminders() {
    setLoading(true);
    setError("");

    try {
      const result = await sharingRequest(
        "/api/shared-reminders"
      );

      setReminders(result.shared_reminders || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReminders();
  }, []);

  function startEditing(reminder) {
    setEditingId(reminder.id);

    setDraft({
      title: reminder.title || "",
      description: reminder.description || "",
      category: reminder.category || "Personal",
      priority: reminder.priority || "Medium",
      repeat: reminder.repeat || "none",
    });
  }

  async function saveChanges(reminderId) {
    setSaving(true);
    setError("");

    try {
      await sharingRequest(
        `/api/shared-reminders/${reminderId}`,
        {
          method: "PATCH",
          body: JSON.stringify(draft),
        }
      );

      setEditingId(null);
      setDraft({});

      await loadReminders();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function updateDraft(field, value) {
    setDraft((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  if (loading) {
    return (
      <div className="shared-loading">
        <LoaderCircle className="spin" size={28} />
        <p>Loading shared reminders...</p>
      </div>
    );
  }

  return (
    <div className="shared-page">
      <section className="shared-page-heading">
        <div>
          <span className="shared-eyebrow">
            COLLABORATION
          </span>

          <h1>Shared with me</h1>

          <p>
            Reminders that other people have shared with you.
          </p>
        </div>

        <button
          type="button"
          className="shared-refresh-button"
          onClick={loadReminders}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </section>

      {error && (
        <div className="share-message error">
          {error}
        </div>
      )}

      {reminders.length === 0 ? (
        <div className="shared-empty-state">
          <div className="shared-empty-icon">
            <Users size={32} />
          </div>

          <h2>No shared reminders yet</h2>

          <p>
            When someone shares a reminder with your account,
            it will appear here.
          </p>
        </div>
      ) : (
        <div className="shared-reminder-list">
          {reminders.map((reminder) => {
            const isEditing = editingId === reminder.id;
            const canEdit = reminder.permission === "editor";

            return (
              <article
                className="shared-reminder-card"
                key={reminder.id}
              >
                <div className="shared-card-top">
                  <span className="shared-category">
                    {reminder.category}
                  </span>

                  <span
                    className={`shared-permission ${
                      canEdit ? "editor" : "viewer"
                    }`}
                  >
                    {canEdit ? "EDITOR ACCESS" : "VIEWER ACCESS"}
                  </span>
                </div>

                {isEditing ? (
                  <div className="shared-edit-form">
                    <label>Reminder title</label>

                    <input
                      value={draft.title}
                      onChange={(event) =>
                        updateDraft("title", event.target.value)
                      }
                    />

                    <label>Description</label>

                    <textarea
                      value={draft.description}
                      onChange={(event) =>
                        updateDraft(
                          "description",
                          event.target.value
                        )
                      }
                    />

                    <label>Category</label>

                    <select
                      value={draft.category}
                      onChange={(event) =>
                        updateDraft("category", event.target.value)
                      }
                    >
                      <option>Study</option>
                      <option>Work</option>
                      <option>Family</option>
                      <option>Personal</option>
                    </select>

                    <label>Priority</label>

                    <select
                      value={draft.priority}
                      onChange={(event) =>
                        updateDraft("priority", event.target.value)
                      }
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>

                    <label>Repeat</label>

                    <select
                      value={draft.repeat}
                      onChange={(event) =>
                        updateDraft("repeat", event.target.value)
                      }
                    >
                      <option value="none">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>

                    <div className="shared-edit-actions">
                      <button
                        type="button"
                        className="shared-save-button"
                        disabled={saving || !draft.title.trim()}
                        onClick={() => saveChanges(reminder.id)}
                      >
                        {saving ? (
                          <LoaderCircle className="spin" size={16} />
                        ) : (
                          <Check size={16} />
                        )}
                        Save
                      </button>

                      <button
                        type="button"
                        className="shared-cancel-button"
                        onClick={() => setEditingId(null)}
                      >
                        <X size={16} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2>{reminder.title}</h2>

                    {reminder.description && (
                      <p className="shared-description">
                        {reminder.description}
                      </p>
                    )}

                    <div className="shared-reminder-meta">
                      <span>
                        <CalendarDays size={15} />
                        {reminder.date || "No date"}
                      </span>

                      {reminder.time && (
                        <span>
                          <Clock size={15} />
                          {reminder.time}
                        </span>
                      )}
                    </div>

                    <div className="shared-card-bottom">
                      <span
                        className={`shared-priority ${
                          (reminder.priority || "Medium").toLowerCase()
                        }`}
                      >
                        {reminder.priority || "Medium"} priority
                      </span>

                      {canEdit && (
                        <button
                          type="button"
                          className="shared-edit-button"
                          onClick={() => startEditing(reminder)}
                        >
                          <Pencil size={16} />
                          Edit
                        </button>
                      )}
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}