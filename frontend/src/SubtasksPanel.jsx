import { useState } from "react";
import { ChevronDown, Plus, Trash2, LoaderCircle } from "lucide-react";
import "./Subtasks.css";

const API_BASE = "http://127.0.0.1:8000";

async function subtaskRequest(path, options = {}) {
  const token = localStorage.getItem("remindme_access_token");

  if (!token) {
    throw new Error("Your session has expired. Please log in again.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  let result = {};

  try {
    result = await response.json();
  } catch {
    // The API may return an empty response.
  }

  if (!response.ok) {
    throw new Error(
      result.detail || `Subtask request failed (${response.status}).`
    );
  }

  return result;
}

export default function SubtasksPanel({ reminderId }) {
  const [subtasks, setSubtasks] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const completedCount = subtasks.filter(
    (item) => item.completed
  ).length;

  const progress = subtasks.length
    ? Math.round((completedCount / subtasks.length) * 100)
    : 0;

  // Load subtasks from the backend
  const loadSubtasks = async () => {
    if (loaded || loading) return;

    setLoading(true);
    setError("");

    try {
      const result = await subtaskRequest(
        `/api/reminders/${encodeURIComponent(reminderId)}/subtasks`
      );

      setSubtasks(
        Array.isArray(result.subtasks) ? result.subtasks : []
      );

      setLoaded(true);
    } catch (requestError) {
      setError(requestError.message || "Unable to load subtasks.");
    } finally {
      setLoading(false);
    }
  };

  // Load subtasks when the section is opened
  const handleOpen = (event) => {
    if (event.currentTarget.open) {
      loadSubtasks();
    }
  };

  // Add a new subtask
  const addSubtask = async (event) => {
    event.preventDefault();

    const title = newTitle.trim();

    if (!title || saving) return;

    setSaving(true);
    setError("");

    try {
      const result = await subtaskRequest(
        `/api/reminders/${encodeURIComponent(reminderId)}/subtasks`,
        {
          method: "POST",
          body: JSON.stringify({ title }),
        }
      );

      if (result.subtask) {
        setSubtasks((previous) => [
          ...previous,
          result.subtask,
        ]);

        setNewTitle("");
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to add subtask.");
    } finally {
      setSaving(false);
    }
  };

  // Mark a subtask as completed or incomplete
  const toggleSubtask = async (subtask) => {
    if (updatingId || deletingId) return;

    const newCompletedStatus = !subtask.completed;

    setUpdatingId(subtask.id);
    setError("");

    try {
      await subtaskRequest(
        `/api/reminders/${encodeURIComponent(reminderId)}/subtasks/${encodeURIComponent(subtask.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            completed: newCompletedStatus,
          }),
        }
      );

      setSubtasks((previous) =>
        previous.map((item) =>
          item.id === subtask.id
            ? { ...item, completed: newCompletedStatus }
            : item
        )
      );
    } catch (requestError) {
      setError(requestError.message || "Unable to update subtask.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Delete a subtask
  const deleteSubtask = async (subtaskId) => {
    if (deletingId || updatingId) return;

    setDeletingId(subtaskId);
    setError("");

    try {
      await subtaskRequest(
        `/api/reminders/${encodeURIComponent(reminderId)}/subtasks/${encodeURIComponent(subtaskId)}`,
        {
          method: "DELETE",
        }
      );

      setSubtasks((previous) =>
        previous.filter((item) => item.id !== subtaskId)
      );
    } catch (requestError) {
      setError(requestError.message || "Unable to delete subtask.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <details className="subtasks-panel" onToggle={handleOpen}>
      <summary className="subtasks-toggle">
        <span className="subtasks-toggle-left">
          <span>Subtasks</span>

          <span className="subtasks-count">
            {completedCount}/{subtasks.length}
          </span>
        </span>

        <span className="subtasks-toggle-right">
          <span>{progress}%</span>
          <ChevronDown size={16} className="subtasks-chevron" />
        </span>
      </summary>

      <div className="subtasks-content">
        {loading && (
          <div className="subtasks-loading">
            <LoaderCircle size={16} className="subtasks-spinner" />
            <span>Loading subtasks...</span>
          </div>
        )}

        {!loading && loaded && (
          <>
            {subtasks.length > 0 && (
              <div className="subtasks-progress-track">
                <div
                  className="subtasks-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {subtasks.length === 0 && (
              <p className="subtasks-empty">
                No subtasks yet. Break this reminder into smaller steps.
              </p>
            )}

            <div className="subtasks-list">
              {subtasks.map((subtask) => (
                <div className="subtask-item" key={subtask.id}>
                  <input
                    type="checkbox"
                    checked={Boolean(subtask.completed)}
                    onChange={() => toggleSubtask(subtask)}
                    disabled={
                      updatingId !== null || deletingId !== null
                    }
                    className="subtask-checkbox"
                    aria-label={`Mark ${subtask.title} as ${
                      subtask.completed ? "incomplete" : "completed"
                    }`}
                  />

                  <span
                    className={
                      subtask.completed
                        ? "subtask-title completed"
                        : "subtask-title"
                    }
                  >
                    {subtask.title}
                  </span>

                  <button
                    type="button"
                    className="subtask-delete"
                    onClick={() => deleteSubtask(subtask.id)}
                    disabled={
                      deletingId !== null || updatingId !== null
                    }
                    title="Delete subtask"
                    aria-label={`Delete ${subtask.title}`}
                  >
                    {deletingId === subtask.id ? (
                      <LoaderCircle
                        size={15}
                        className="subtasks-spinner"
                      />
                    ) : (
                      <Trash2 size={15} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {error && (
          <p className="subtasks-error">
            {error}
          </p>
        )}

        <form className="subtask-add-form" onSubmit={addSubtask}>
          <input
            type="text"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Add a subtask..."
            maxLength={200}
            disabled={saving}
          />

          <button
            type="submit"
            disabled={!newTitle.trim() || saving}
            title="Add subtask"
          >
            {saving ? (
              <LoaderCircle size={16} className="subtasks-spinner" />
            ) : (
              <Plus size={16} />
            )}
          </button>
        </form>
      </div>
    </details>
  );
}