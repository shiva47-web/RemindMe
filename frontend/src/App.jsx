import { useState, useEffect } from "react";
import SubtasksPanel from "./SubtasksPanel";
import FocusMode from "./FocusMode";
import AttachmentPanel from "./AttachmentPanel";
import VoiceInput from "./VoiceInput";
import "./App.css";
import "./Calendar.css";
import ShareReminderButton from "./ShareReminderButton";
import SharedReminders from "./SharedReminders";
import "./SmartFilters.css";
import "./ReminderTemplates.css";
import { API_BASE } from "./config";
<VoiceInput
  onTranscript={(transcript) => {
    setNewTask((previous) => ({
      ...previous,
      title: transcript,
    }));
  }}
/>
import {
  LayoutDashboard,
  CalendarDays,
  CheckCircle2,
  Clock,
  Settings,
  Plus,
  Search,
  Bell,
  Menu,
  GraduationCap,
  BriefcaseBusiness,
  House,
  UserRound,
  ArrowUpRight,
  Flame,
  Sun,
  MoreHorizontal,
  CircleCheck,
  Target,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Pencil,
  CalendarCheck,
} from "lucide-react";

import "./App.css";
import "./Calendar.css";

// GET TODAY'S DATE
const getToday = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// CONVERT DATE TO YYYY-MM-DD
function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// CONVERT YYYY-MM-DD TO LOCAL DATE
function fromISODate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);

  return new Date(year, month - 1, day);
}

// CHECK WHETHER A REMINDER OCCURS ON A PARTICULAR DATE
function isTaskScheduledOnDate(task, dateString) {
  if (!task.date || !dateString || dateString < task.date) {
    return false;
  }

  const repeat = task.repeat || "none";

  if (repeat === "none") {
    return task.date === dateString;
  }

  const startDate = fromISODate(task.date);
  const targetDate = fromISODate(dateString);

  if (repeat === "daily") {
    return true;
  }

  if (repeat === "weekly") {
    return startDate.getDay() === targetDate.getDay();
  }

  if (repeat === "monthly") {
    return startDate.getDate() === targetDate.getDate();
  }

  return task.date === dateString;
}

// RECURRING REMINDERS ARE COMPLETED PER OCCURRENCE
function isTaskDoneOnDate(task, dateString) {
  if (task.repeat && task.repeat !== "none") {
    return Array.isArray(task.completedDates) &&
      task.completedDates.includes(dateString);
  }

  return Boolean(task.done);
}

// NEXT DATE FOR DISPLAYING A REMINDER
function getNextOccurrenceDate(task, fromDate = getToday()) {
  if (!task.date) return null;

  const start = task.date > fromDate ? task.date : fromDate;

  if (task.repeat === "none" || !task.repeat) {
    return task.date >= fromDate && !task.done
      ? task.date
      : null;
  }

  const cursor = fromISODate(start);

  // Search forward for the next scheduled occurrence that is not completed.
  for (let offset = 0; offset <= 366; offset += 1) {
    const candidate = new Date(cursor);
    candidate.setDate(cursor.getDate() + offset);
    const candidateString = toISODate(candidate);

    if (
      isTaskScheduledOnDate(task, candidateString) &&
      !isTaskDoneOnDate(task, candidateString)
    ) {
      return candidateString;
    }
  }

  return null;
}

// FORMAT TIME
function formatTime(time) {
  if (!time) return "Anytime";

  const [hours, minutes] = time.split(":");
  const date = new Date();

  date.setHours(Number(hours), Number(minutes));

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// INITIAL TASKS
const initialTasks = [
  {
    id: 1,
    title: "Complete DBMS assignment",
    description: "Finish the database assignment.",
    category: "Study",
    date: getToday(),
    time: "09:00",
    priority: "High",
    done: false,
  },
  {
    id: 2,
    title: "Prepare project presentation",
    description: "Prepare slides for the project.",
    category: "Work",
    date: getToday(),
    time: "11:30",
    priority: "Medium",
    done: false,
  },
  {
    id: 3,
    title: "Buy groceries",
    description: "Purchase household essentials.",
    category: "Personal",
    date: getToday(),
    time: "16:00",
    priority: "Low",
    done: true,
  },
  {
    id: 4,
    title: "Revise Computer Networks",
    description: "Revise important networking concepts.",
    category: "Study",
    date: getToday(),
    time: "18:00",
    priority: "High",
    done: false,
  },
];

// CALENDAR COMPONENT
function CalendarView({
  tasks,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const today = new Date();

    return new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );
  });

  const [selectedDate, setSelectedDate] = useState(getToday());

  const todayString = getToday();

  // MONTH NAME
  const monthTitle = viewMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // GET DAYS FOR CALENDAR GRID
  const getCalendarDays = () => {
    const firstDay = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth(),
      1
    );

    // Monday is the first day of the week.
    const startingOffset = (firstDay.getDay() + 6) % 7;

    const startDate = new Date(firstDay);

    startDate.setDate(firstDay.getDate() - startingOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(startDate);

      day.setDate(startDate.getDate() + index);

      return day;
    });
  };

  const calendarDays = getCalendarDays();

  // SELECT A CALENDAR DATE
  const selectDate = (date) => {
    setSelectedDate(toISODate(date));

    if (
      date.getMonth() !== viewMonth.getMonth() ||
      date.getFullYear() !== viewMonth.getFullYear()
    ) {
      setViewMonth(
        new Date(date.getFullYear(), date.getMonth(), 1)
      );
    }
  };

  // MOVE BETWEEN MONTHS
  const changeMonth = (amount) => {
    setViewMonth(
      (previous) =>
        new Date(
          previous.getFullYear(),
          previous.getMonth() + amount,
          1
        )
    );
  };

  // TASKS ON SELECTED DATE
  const selectedTasks = tasks
    .filter((task) => isTaskScheduledOnDate(task, selectedDate))
    .sort((a, b) => {
      return (a.time || "23:59").localeCompare(
        b.time || "23:59"
      );
    });

  // PRETTY SELECTED DATE
  const selectedDateLabel = fromISODate(
    selectedDate
  ).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <section className="calendar-page">

      {/* CALENDAR HEADER */}

      <div className="calendar-page-header">
        <div>
          <div className="calendar-eyebrow">
            <CalendarDays size={16} />
            YOUR SCHEDULE
          </div>

          <h1>
            Your <span>Calendar.</span>
          </h1>

          <p>
            Plan your days. Keep your life organized.
          </p>
        </div>

        <button
          className="add-button"
          onClick={() => onAdd(selectedDate)}
        >
          <Plus size={18} />
          Add reminder
        </button>
      </div>

      {/* CALENDAR AND DETAILS */}

      <div className="calendar-content-grid">

        {/* MONTHLY CALENDAR */}

        <div className="calendar-month-card">

          <div className="calendar-month-header">

            <div>
              <span>MONTHLY VIEW</span>
              <h2>{monthTitle}</h2>
            </div>

            <div className="calendar-navigation">

              <button
                onClick={() => changeMonth(-1)}
                title="Previous month"
                aria-label="Previous month"
              >
                <ChevronLeft size={20} />
              </button>

              <button
                onClick={() => changeMonth(1)}
                title="Next month"
                aria-label="Next month"
              >
                <ChevronRight size={20} />
              </button>

            </div>

          </div>

          <button
            className="calendar-today-button"
            onClick={() => {
              const today = new Date();

              setViewMonth(
                new Date(
                  today.getFullYear(),
                  today.getMonth(),
                  1
                )
              );

              setSelectedDate(getToday());
            }}
          >
            <CalendarCheck size={15} />
            Go to today
          </button>

          {/* WEEKDAY LABELS */}

          <div className="calendar-weekdays">
            {[
              "MON",
              "TUE",
              "WED",
              "THU",
              "FRI",
              "SAT",
              "SUN",
            ].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* CALENDAR DAYS */}

          <div className="calendar-days-grid">

            {calendarDays.map((day) => {
              const dateString = toISODate(day);

              const isCurrentMonth =
                day.getMonth() === viewMonth.getMonth();

              const isToday = dateString === todayString;

              const isSelected =
                dateString === selectedDate;

              const dayTasks = tasks.filter(
                (task) => isTaskScheduledOnDate(task, dateString)
              );

              return (
                <button
                  key={dateString}
                  className={[
                    "calendar-day",
                    !isCurrentMonth ? "outside-month" : "",
                    isToday ? "calendar-today" : "",
                    isSelected ? "calendar-selected" : "",
                    dayTasks.length > 0
                      ? "calendar-has-tasks"
                      : "",
                  ].join(" ")}
                  onClick={() => selectDate(day)}
                  aria-label={`${dateString}, ${dayTasks.length} reminders`}
                  aria-pressed={isSelected}
                >

                  <span className="calendar-day-number">
                    {day.getDate()}
                  </span>

                  {dayTasks.length > 0 && (
                    <span className="calendar-task-indicator">
                      {dayTasks.length > 3
                        ? "3+"
                        : dayTasks.length}
                    </span>
                  )}

                </button>
              );
            })}

          </div>

          {/* CALENDAR LEGEND */}

          <div className="calendar-legend">

            <span>
              <i className="legend-today"></i>
              Today
            </span>

            <span>
              <i className="legend-reminder"></i>
              Has reminders
            </span>

            <span>
              <i className="legend-selected"></i>
              Selected date
            </span>

          </div>

        </div>

        {/* SELECTED DATE TASKS */}

        <div className="calendar-details-card">

          <div className="calendar-details-header">

            <div className="calendar-details-icon">
              <CalendarDays size={23} />
            </div>

            <div>
              <span>YOUR SCHEDULE</span>
              <h2>Day overview</h2>
            </div>

          </div>

          <div className="selected-date-heading">
            <h3>{selectedDateLabel}</h3>

            <p>
              {selectedTasks.length} reminder
              {selectedTasks.length !== 1 ? "s" : ""}
              scheduled
            </p>
          </div>

          <div className="calendar-task-list">

            {selectedTasks.length === 0 ? (

              <div className="calendar-empty-state">
                <div>
                  <CalendarDays size={30} />
                </div>

                <h3>No reminders yet</h3>

                <p>
                  This day is free. Add a reminder to
                  plan something.
                </p>

                <button
                  className="add-button"
                  onClick={() => onAdd(selectedDate)}
                >
                  <Plus size={17} />
                  Create reminder
                </button>
              </div>

            ) : (

              selectedTasks.map((task) => (

                <div
                  className="calendar-task-item"
                  key={task.id}
                >

                  <div className="calendar-task-time">
                    {formatTime(task.time)}
                  </div>

                  <div className="calendar-task-information">

                    <h4
                      className={
                        isTaskDoneOnDate(task, selectedDate)
                          ? "calendar-task-completed"
                          : ""
                      }
                    >
                      {task.title}
                    </h4>

                    <span>
                      {task.category} · {task.priority} priority
                      {task.repeat && task.repeat !== "none"
                        ? ` · Repeats ${task.repeat}`
                        : ""}
                    </span>

                  </div>

                  <div className="calendar-task-actions">

                    <button
                      onClick={() => onToggle(task.id, selectedDate)}
                      title={
                        isTaskDoneOnDate(task, selectedDate)
                          ? "Mark as incomplete"
                          : "Mark as complete"
                      }
                    >
                      <CheckCircle2 size={17} />
                    </button>

                    <button
                      onClick={() => onEdit(task)}
                      title="Edit reminder"
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      onClick={() => onDelete(task.id)}
                      title="Delete reminder"
                    >
                      <Trash2 size={16} />
                    </button>

                  </div>

                </div>

              ))

            )}

          </div>

          {selectedTasks.length > 0 && (
            <button
              className="calendar-add-another"
              onClick={() => onAdd(selectedDate)}
            >
              <Plus size={17} />
              Add another reminder
            </button>
          )}

        </div>

      </div>

      {/* CALENDAR FOOTER */}

      <div className="calendar-footer-note">
        <Sparkles size={17} />
        A little planning today makes tomorrow easier.
      </div>

    </section>
  );
}

function App() {

  // LOAD SAVED TASKS

  const [tasks, setTasks] = useState(() => {
    try {
      const savedTasks = localStorage.getItem("remindme_tasks");

      return savedTasks
        ? JSON.parse(savedTasks)
        : initialTasks;
    } catch (error) {
      console.error("Unable to load tasks:", error);
      return initialTasks;
    }
  });

  const [activePage, setActivePage] = useState("Overview");
  // SMART SEARCH AND ADVANCED FILTERS

const [searchQuery, setSearchQuery] = useState("");
const [filterCategory, setFilterCategory] = useState("all");
const [filterPriority, setFilterPriority] = useState("all");
const [filterStatus, setFilterStatus] = useState("all");
const [filterDate, setFilterDate] = useState("");

  const [showModal, setShowModal] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState(null);

  // NOTIFICATION PERMISSION

  const [notificationPermission, setNotificationPermission] =
    useState(() => {
      if (!("Notification" in window)) {
        return "unsupported";
      }

      return Notification.permission;
    });

  // NEW REMINDER FORM

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    date: getToday(),
    time: "",
    category: "Personal",
    priority: "Medium",
    repeat: "none",
  });
  // REMINDER TEMPLATES

const [reminderTemplates, setReminderTemplates] = useState(() => {
  try {
    const saved = localStorage.getItem("remindme_templates");

    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    console.error("Unable to load templates:", error);
  }

  // DEFAULT TEMPLATES

  return [
    {
      id: "study-template",
      name: "Study Session",
      title: "Study session",
      description: "Review notes and practice questions.",
      category: "Study",
      priority: "Medium",
      repeat: "none",
      time: "",
    },
    {
      id: "assignment-template",
      name: "Assignment",
      title: "Complete assignment",
      description: "Work on the assignment and review before submission.",
      category: "Study",
      priority: "High",
      repeat: "none",
      time: "",
    },
    {
      id: "meeting-template",
      name: "Work Meeting",
      title: "Team meeting",
      description: "Prepare topics and meeting notes.",
      category: "Work",
      priority: "Medium",
      repeat: "none",
      time: "",
    },
    {
      id: "bill-template",
      name: "Bill Payment",
      title: "Pay pending bill",
      description: "Check the amount and complete the payment.",
      category: "Personal",
      priority: "High",
      repeat: "none",
      time: "",
    },
  ];
});

const [selectedTemplateId, setSelectedTemplateId] = useState("");

// SAVE TEMPLATES

useEffect(() => {
  try {
    localStorage.setItem(
      "remindme_templates",
      JSON.stringify(reminderTemplates)
    );
  } catch (error) {
    console.error("Unable to save templates:", error);
  }
}, [reminderTemplates]);

  // SAVE TASKS
  // SAVE TASKS TO LOCAL STORAGE
useEffect(() => {
  try {
    localStorage.setItem(
      "remindme_tasks",
      JSON.stringify(tasks)
    );
  } catch (error) {
    console.error("Unable to save reminders:", error);
  }
}, [tasks]);

 // LOAD ACTIVE SNOOZES FROM POSTGRESQL
useEffect(() => {
  const token = localStorage.getItem(
    "remindme_access_token"
  );

  if (!token) return;

  let cancelled = false;

  const loadSnoozes = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/reminders/snoozes`
        ,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) return;

      const result = await response.json();

      if (cancelled) return;

      const snoozeMap = new Map(
        (result.snoozes || []).map((item) => [
          `${item.reminder_id}|${item.occurrence_date}`,
          item,
        ])
      );

      setTasks((previous) =>
        previous.map((task) => {
          const key = `${task.id}|${getToday()}`;
          const record = snoozeMap.get(key);

          return {
            ...task,
            snoozedUntil: record
              ? record.snoozed_until
              : null,
            snoozedDate: record
              ? record.occurrence_date
              : null,
          };
        })
      );

    } catch (error) {
      console.error("Unable to load snoozes:", error);
    }
    // =====================================================
// REMINDME SUBTASKS
// =====================================================

function LegacySubtasksPanel({ reminderId }) {
  const [subtasks, setSubtasks] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");

  const API_URL = API_BASE;

  const getToken = () =>
    localStorage.getItem("remindme_access_token");

  // LOAD SUBTASKS FROM POSTGRESQL
  const loadSubtasks = async () => {
    const token = getToken();

    if (!token) {
      setError("Please log in again.");
      setLoading(false);
      return;
    }

    try {
      setError("");

      const response = await fetch(
        `${API_URL}/api/reminders/${encodeURIComponent(reminderId)}/subtasks`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || "Unable to load subtasks."
        );
      }

      setSubtasks(result.subtasks || []);

    } catch (err) {
      console.error("Subtask loading error:", err);
      setError(err.message);

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubtasks();
  }, [reminderId]);

  // ADD SUBTASK
  const addSubtask = async (event) => {
    event.preventDefault();

    const title = newTitle.trim();

    if (!title || saving) return;

    const token = getToken();

    if (!token) {
      setError("Please log in again.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/reminders/${encodeURIComponent(reminderId)}/subtasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || "Unable to add subtask."
        );
      }

      setSubtasks((previous) => [
        ...previous,
        result.subtask,
      ]);

      setNewTitle("");

    } catch (err) {
      console.error("Subtask creation error:", err);
      setError(err.message);

    } finally {
      setSaving(false);
    }
  };

  // COMPLETE OR UNCOMPLETE SUBTASK
  const toggleSubtask = async (subtask) => {
    const token = getToken();

    if (!token) {
      setError("Please log in again.");
      return;
    }

    const updatedCompleted = !subtask.completed;

    try {
      setError("");

      const response = await fetch(
        `${API_URL}/api/reminders/${encodeURIComponent(reminderId)}/subtasks/${encodeURIComponent(subtask.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            completed: updatedCompleted,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || "Unable to update subtask."
        );
      }

      setSubtasks((previous) =>
        previous.map((item) =>
          item.id === subtask.id
            ? result.subtask
            : item
        )
      );

    } catch (err) {
      console.error("Subtask update error:", err);
      setError(err.message);
    }
  };

  // DELETE SUBTASK
  const deleteSubtask = async (subtaskId) => {
    const token = getToken();

    if (!token) {
      setError("Please log in again.");
      return;
    }

    try {
      setError("");

      const response = await fetch(
        `${API_URL}/api/reminders/${encodeURIComponent(reminderId)}/subtasks/${encodeURIComponent(subtaskId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || "Unable to delete subtask."
        );
      }

      setSubtasks((previous) =>
        previous.filter(
          (item) => item.id !== subtaskId
        )
      );

    } catch (err) {
      console.error("Subtask deletion error:", err);
      setError(err.message);
    }
  };

  // PROGRESS
  const completedCount = subtasks.filter(
    (item) => item.completed
  ).length;

  const progress = subtasks.length
    ? Math.round(
        (completedCount / subtasks.length) * 100
      )
    : 0;

  return (
    <div className="subtasks-panel">

      <button
        type="button"
        className="subtasks-toggle"
        onClick={() =>
          setExpanded((previous) => !previous)
        }
        aria-expanded={expanded}
      >
        <span className="subtasks-toggle-left">
          <CheckCircle2 size={15} />

          <span>Subtasks</span>

          <span className="subtasks-count">
            {completedCount}/{subtasks.length}
          </span>
        </span>

        <span className="subtasks-toggle-right">
          {subtasks.length > 0 && `${progress}%`}

          <ChevronRight
            size={16}
            className={
              expanded ? "subtasks-chevron-open" : ""
            }
          />
        </span>
      </button>

      {expanded && (
        <div className="subtasks-content">

          {subtasks.length > 0 && (
            <div className="subtasks-progress-track">
              <div
                className="subtasks-progress-fill"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          )}

          {loading ? (
            <p className="subtasks-status">
              Loading subtasks...
            </p>
          ) : (
            <>
              {subtasks.length === 0 ? (
                <p className="subtasks-empty">
                  No subtasks yet. Break this reminder
                  into smaller steps.
                </p>
              ) : (
                <div className="subtasks-list">

                  {subtasks.map((subtask) => (
                    <div
                      className="subtask-item"
                      key={subtask.id}
                    >

                      <button
                        type="button"
                        className={`subtask-checkbox ${
                          subtask.completed ? "completed" : ""
                        }`}
                        onClick={() =>
                          toggleSubtask(subtask)
                        }
                        aria-label={
                          subtask.completed
                            ? "Mark incomplete"
                            : "Mark complete"
                        }
                      >
                        {subtask.completed && (
                          <CheckCircle2 size={15} />
                        )}
                      </button>

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
                        onClick={() =>
                          deleteSubtask(subtask.id)
                        }
                        title="Delete subtask"
                        aria-label="Delete subtask"
                      >
                        <Trash2 size={14} />
                      </button>

                    </div>
                  ))}

                </div>
              )}

              <form
                className="subtask-add-form"
                onSubmit={addSubtask}
              >
                <input
                  type="text"
                  value={newTitle}
                  maxLength={200}
                  placeholder="Add a smaller step..."
                  onChange={(event) =>
                    setNewTitle(event.target.value)
                  }
                />

                <button
                  type="submit"
                  disabled={!newTitle.trim() || saving}
                  title="Add subtask"
                >
                  <Plus size={17} />
                </button>
              </form>
            </>
          )}

          {error && (
            <p className="subtasks-error">
              {error}
            </p>
          )}

        </div>
      )}

    </div>
  );
}
  };

  loadSnoozes();

  return () => {
    cancelled = true;
  };
}, []);

  // REQUEST NOTIFICATION PERMISSION

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      alert("Your browser does not support notifications.");
      return;
    }

    try {
      const permission =
        await Notification.requestPermission();

      setNotificationPermission(permission);

      if (permission === "granted") {
        new Notification(
          "RemindMe notifications enabled!",
          {
            body:
              "You will receive alerts when your reminders are due.",
          }
        );
      } else if (permission === "denied") {
        alert(
          "Notifications are blocked. Please enable them in your browser settings."
        );
      }
    } catch (error) {
      console.error("Notification permission error:", error);
    }
  };

  // CHECK REMINDERS AND SEND NOTIFICATIONS
  useEffect(() => {
    if (
      notificationPermission !== "granted" ||
      !("Notification" in window)
    ) {
      return;
    }

    const checkReminders = () => {
      if (Notification.permission !== "granted") {
        return;
      }

      let notifiedOccurrences = [];
      let legacyNotifiedIds = [];

      try {
        notifiedOccurrences = JSON.parse(
          localStorage.getItem("remindme_notified_occurrences") || "[]"
        );

        legacyNotifiedIds = JSON.parse(
          localStorage.getItem("remindme_notified_ids") || "[]"
        );

        if (!Array.isArray(notifiedOccurrences)) {
          notifiedOccurrences = [];
        }

        if (!Array.isArray(legacyNotifiedIds)) {
          legacyNotifiedIds = [];
        }
      } catch (error) {
        console.error("Unable to read notification records:", error);
        notifiedOccurrences = [];
        legacyNotifiedIds = [];
      }

      const todayDate = getToday();
      const now = new Date();
      const updatedOccurrences = [...notifiedOccurrences];

      tasks.forEach((task) => {
        if (
          !task.date ||
          !task.time ||
          !isTaskScheduledOnDate(task, todayDate) ||
          isTaskDoneOnDate(task, todayDate)
        ) {
          return;
        }
// Snoozed occurrences are handled by the
// PostgreSQL background push scheduler.
if (task.snoozedDate === todayDate) {
  return;
}
        const occurrenceKey = `${task.id}|${todayDate}`;
        const wasAlreadyNotified =
          notifiedOccurrences.includes(occurrenceKey);

        // Respect notification records created by the previous
        // one-time reminder implementation.
        const wasLegacyNotified =
          (!task.repeat || task.repeat === "none") &&
          legacyNotifiedIds.map(String).includes(String(task.id));

        if (wasAlreadyNotified || wasLegacyNotified) {
          return;
        }

        const reminderDate = new Date(
          `${todayDate}T${task.time}:00`
        );

        if (
          Number.isNaN(reminderDate.getTime()) ||
          now.getTime() < reminderDate.getTime()
        ) {
          return;
        }

        try {
          const isHighPriority = task.priority === "High";

const notification = new Notification(
  isHighPriority
    ? `🚨 HIGH PRIORITY: ${task.title}`
    : `Reminder: ${task.title}`,
  {
    body: isHighPriority
      ? `Important reminder! ${
          task.description ||
          `${task.category || "Personal"} task is due now.`
        }`
      : task.description ||
        `${task.category || "Personal"} reminder is due now!`,

    tag: `remindme-${task.id}-${todayDate}`,

    requireInteraction: isHighPriority,
  }
);

          notification.onclick = () => {
            window.focus();
            notification.close();
          };

          updatedOccurrences.push(occurrenceKey);
        } catch (error) {
          console.error("Unable to send notification:", error);
        }
      });

      if (updatedOccurrences.length !== notifiedOccurrences.length) {
        localStorage.setItem(
          "remindme_notified_occurrences",
          JSON.stringify(updatedOccurrences)
        );
      }
    };

    checkReminders();

    const interval = window.setInterval(checkReminders, 5000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkReminders();
      }
    };

    window.addEventListener("focus", checkReminders);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checkReminders);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [tasks, notificationPermission]);

  // OPEN FORM TO CREATE A NEW REMINDER

  const openCreateModal = (date = getToday()) => {
    setEditingTaskId(null);
    // APPLY A SAVED TEMPLATE

const applyReminderTemplate = (templateId) => {
  const template = reminderTemplates.find(
    (item) => String(item.id) === String(templateId)
  );

  if (!template) return;

  setEditingTaskId(null);

  setNewTask({
    title: template.title || "",
    description: template.description || "",
    date: getToday(),
    time: template.time || "",
    category: template.category || "Personal",
    priority: template.priority || "Medium",
    repeat: template.repeat || "none",
  });
};

// SAVE CURRENT REMINDER AS A TEMPLATE

const saveReminderTemplate = () => {
  if (!newTask.title.trim()) {
    alert("Enter a reminder title before saving a template.");
    return;
  }

  const name = window.prompt(
    "Enter a name for this template:",
    newTask.title.trim()
  );

  if (name === null) return;

  if (!name.trim()) {
    alert("Template name cannot be empty.");
    return;
  }

  const template = {
    id: `template-${Date.now()}`,
    name: name.trim(),
    title: newTask.title.trim(),
    description: newTask.description || "",
    category: newTask.category || "Personal",
    priority: newTask.priority || "Medium",
    repeat: newTask.repeat || "none",
    time: newTask.time || "",
  };

  setReminderTemplates((previous) => [
    template,
    ...previous,
  ]);

  setSelectedTemplateId(template.id);

  alert("Reminder template saved successfully!");
};

// DELETE A SAVED TEMPLATE

const deleteReminderTemplate = (templateId) => {
  const template = reminderTemplates.find(
    (item) => String(item.id) === String(templateId)
  );

  if (!template) return;

  const confirmed = window.confirm(
    `Delete the "${template.name}" template?`
  );

  if (!confirmed) return;

  setReminderTemplates((previous) =>
    previous.filter(
      (item) => String(item.id) !== String(templateId)
    )
  );

  setSelectedTemplateId("");
};

    setNewTask({
      title: "",
      description: "",
      date,
      time: "",
      category: "Personal",
      priority: "Medium",
      repeat: "none",
    });

    setShowModal(true);
  };

  // OPEN FORM TO EDIT AN EXISTING REMINDER

  const openEditModal = (task) => {
    setEditingTaskId(task.id);

    setNewTask({
      title: task.title || "",
      description: task.description || "",
      date: task.date || getToday(),
      time: task.time || "",
      category: task.category || "Personal",
      priority: task.priority || "Medium",
      repeat: task.repeat || "none",
    });

    setShowModal(true);
  };

  // SAVE NEW OR EDITED REMINDER
  const saveTask = (e) => {
    e.preventDefault();

    if (!newTask.title.trim()) return;

    if (editingTaskId !== null) {
      setTasks((previous) =>
        previous.map((task) =>
          task.id === editingTaskId
            ? {
                ...task,
                ...newTask,
                title: newTask.title.trim(),
              }
            : task
        )
      );

      // Editing a recurring reminder updates the whole series.
      // Clear previous notification records so the new schedule
      // can notify at its next occurrence.
      try {
        const occurrenceRecords = JSON.parse(
          localStorage.getItem("remindme_notified_occurrences") || "[]"
        );

        localStorage.setItem(
          "remindme_notified_occurrences",
          JSON.stringify(
            occurrenceRecords.filter(
              (key) => !String(key).startsWith(`${editingTaskId}|`)
            )
          )
        );

        const legacyIds = JSON.parse(
          localStorage.getItem("remindme_notified_ids") || "[]"
        );

        localStorage.setItem(
          "remindme_notified_ids",
          JSON.stringify(
            legacyIds.filter(
              (id) => String(id) !== String(editingTaskId)
            )
          )
        );
      } catch (error) {
        console.error("Unable to update notification records:", error);
      }
    } else {
      const task = {
        id: Date.now(),
        ...newTask,
        title: newTask.title.trim(),
        done: false,
        completedDates: [],
      };

      setTasks((previous) => [...previous, task]);
    }

    setEditingTaskId(null);

    setNewTask({
      title: "",
      description: "",
      date: getToday(),
      time: "",
      category: "Personal",
      priority: "Medium",
      repeat: "none",
    });

    setShowModal(false);
  };

  // COMPLETE A ONE-TIME REMINDER OR A SINGLE RECURRING OCCURRENCE
  const toggleTask = (id, occurrenceDate = getToday()) => {
    setTasks((previous) =>
      previous.map((task) => {
        if (task.id !== id) return task;

        if (task.repeat && task.repeat !== "none") {
          const completedDates = Array.isArray(task.completedDates)
            ? task.completedDates
            : [];

          const isCompleted = completedDates.includes(occurrenceDate);

          return {
            ...task,
            completedDates: isCompleted
              ? completedDates.filter((date) => date !== occurrenceDate)
              : [...completedDates, occurrenceDate],
          };
        }

        return {
          ...task,
          done: !task.done,
        };
      })
    );
  };

  // DELETE TASK

  const deleteTask = (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this reminder and all its future repeats?"
    );

    if (confirmDelete) {
      setTasks((previous) =>
        previous.filter((task) => task.id !== id)
      );

      try {
        const notifiedIds = JSON.parse(
          localStorage.getItem("remindme_notified_ids") || "[]"
        );

        localStorage.setItem(
          "remindme_notified_ids",
          JSON.stringify(
            notifiedIds.filter(
              (savedId) => String(savedId) !== String(id)
            )
          )
        );

        const occurrenceRecords = JSON.parse(
          localStorage.getItem("remindme_notified_occurrences") || "[]"
        );

        localStorage.setItem(
          "remindme_notified_occurrences",
          JSON.stringify(
            occurrenceRecords.filter(
              (key) => !String(key).startsWith(`${id}|`)
            )
          )
        );
      } catch (error) {
        console.error(
          "Unable to update notification records:",
          error
        );
      }
    }
  };
  // SNOOZE REMINDER

const snoozeTask = async (id, minutes) => {
  const token = localStorage.getItem(
    "remindme_access_token"
  );

  if (!token) {
    alert("Please log in again.");
    return;
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:8000/api/reminders/${encodeURIComponent(id)}/snooze`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          minutes: Number(minutes),
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.detail || "Unable to snooze reminder."
      );
    }

    const occurrenceKey =
      `${id}|${result.occurrence_date}`;

    // Remove the old local notification record.
    try {
      const records = JSON.parse(
        localStorage.getItem(
          "remindme_notified_occurrences"
        ) || "[]"
      );

      localStorage.setItem(
        "remindme_notified_occurrences",
        JSON.stringify(
          records.filter(
            (key) => key !== occurrenceKey
          )
        )
      );

      const oldIds = JSON.parse(
        localStorage.getItem(
          "remindme_notified_ids"
        ) || "[]"
      );

      localStorage.setItem(
        "remindme_notified_ids",
        JSON.stringify(
          oldIds.filter(
            (savedId) => String(savedId) !== String(id)
          )
        )
      );

    } catch (storageError) {
      console.error(
        "Unable to update notification history:",
        storageError
      );
    }

    // Update the dashboard immediately.
    setTasks((previous) =>
      previous.map((task) =>
        String(task.id) === String(id)
          ? {
              ...task,
              snoozedUntil: result.snoozed_until,
              snoozedDate: result.occurrence_date,
            }
          : task
      )
    );

    const displayTime = new Date(
      result.snoozed_until
    ).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    alert(
      `Reminder snoozed for ${minutes} minutes. It will notify you again at ${displayTime}.`
    );

  } catch (error) {
    console.error("Snooze error:", error);
    alert(error.message);
  }
};

  // NAVIGATION

 const menuItems = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "My Tasks", icon: CheckCircle2 },
  { name: "Calendar", icon: CalendarDays },
  { name: "Upcoming", icon: Clock },
  { name: "Shared Reminders", icon: UserRound },
];

  // CATEGORIES

  const categories = [
    { name: "Study", icon: GraduationCap, color: "purple" },
    { name: "Work", icon: BriefcaseBusiness, color: "blue" },
    { name: "Family", icon: House, color: "orange" },
    { name: "Personal", icon: UserRound, color: "green" },
  ];

  // CURRENT DATE

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "2-digit",
  }).toUpperCase();

// FILTER TASKS

const pageTasks =
  activePage === "Upcoming"
    ? tasks.filter(
        (task) =>
          !isTaskDoneOnDate(task, getToday()) &&
          (
            task.date > getToday() ||
            (task.repeat && task.repeat !== "none")
          )
      )
    : categories.some(
        (category) => category.name === activePage
      )
      ? tasks.filter(
          (task) => task.category === activePage
        )
      : tasks;

// Search is global: searching can find reminders from every category.

const searchableTasks = searchQuery.trim()
  ? tasks
  : pageTasks;

const visibleTasks = searchableTasks.filter((task) => {

  const query = searchQuery.trim().toLowerCase();

  const matchesSearch =
    !query ||
    (task.title || "").toLowerCase().includes(query) ||
    (task.description || "").toLowerCase().includes(query);

  const matchesCategory =
    filterCategory === "all" ||
    task.category === filterCategory;

  const matchesPriority =
    filterPriority === "all" ||
    (task.priority || "Medium").toLowerCase() === filterPriority;

  const statusDate =
    filterDate ||
    (
      task.repeat && task.repeat !== "none"
        ? getToday()
        : task.date
    );

  const isCompleted = isTaskDoneOnDate(
    task,
    statusDate
  );

  const matchesStatus =
    filterStatus === "all" ||
    (
      filterStatus === "completed"
        ? isCompleted
        : !isCompleted
    );

  const matchesDate =
    !filterDate ||
    isTaskScheduledOnDate(task, filterDate);

  return (
    matchesSearch &&
    matchesCategory &&
    matchesPriority &&
    matchesStatus &&
    matchesDate
  );
});

  // COMPLETED TASKS

  const completed = tasks.filter((task) =>
    isTaskDoneOnDate(
      task,
      task.repeat && task.repeat !== "none"
        ? getToday()
        : task.date
    )
  ).length;

  const progress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;

  return (
    <div className="app-layout">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="brand">
          <div className="brand-icon">
            <Clock size={23} />
          </div>

          <span>
            Remind<span className="brand-highlight">Me.</span>
          </span>
        </div>

        <div className="workspace-label">
          WORKSPACE
        </div>

        <nav className="sidebar-nav">

          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                className={`nav-item ${
                  activePage === item.name ? "active" : ""
                }`}
                onClick={() => setActivePage(item.name)}
              >
                <Icon size={19} />
                <span>{item.name}</span>
              </button>
            );
          })}

        </nav>

        <div className="workspace-label category-heading">
          YOUR CATEGORIES
        </div>

        <div className="category-list">

          {categories.map((category) => {
            const Icon = category.icon;

            return (
              <button
                className="category-item"
                key={category.name}
                onClick={() => setActivePage(category.name)}
              >
                <span
                  className={`category-dot ${category.color}`}
                >
                  <Icon size={16} />
                </span>

                {category.name}
              </button>
            );
          })}

        </div>

        <div className="sidebar-bottom">

         <button
  type="button"
  className="upgrade-card remy-sidebar-card"
  onClick={() =>
    window.dispatchEvent(new Event("remy:open"))
  }
>
  <div className="upgrade-icon">
    <Sparkles size={21} />
  </div>

  <h4>A little more organized?</h4>

  <p>
    Your goals are closer than you think.
  </p>

  <span className="remy-sidebar-link">
    Chat with Remy
    <ArrowUpRight size={14} />
  </span>
</button>

          <button
            className="nav-item settings-item"
            onClick={() => setActivePage("Settings")}
          >
            <Settings size={19} />
            Settings
          </button>

          <div className="profile">

            <div className="avatar">S</div>

            <div className="profile-info">
              <strong>Shiva</strong>
              <span>Personal workspace</span>
            </div>

            <MoreHorizontal size={20} />

          </div>

        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main className="main-content">

        {/* TOPBAR */}

        <header className="topbar">

          <button className="mobile-menu">
            <Menu size={22} />
          </button>

          <div className="breadcrumb">
            My Workspace
            <ChevronRight size={15} />
            {activePage}
          </div>

          <div className="top-actions">

           <button
  type="button"
  className="icon-button"
  title="Search reminders"
  aria-label="Search reminders"
  onClick={() =>
    document.getElementById("remindme-search")?.focus()
  }
>
  <Search size={19} />
</button>

            <button
              className="icon-button notification"
              onClick={enableNotifications}
              title="Enable browser notifications"
              aria-label="Enable browser notifications"
            >
              <Bell size={19} />

              {notificationPermission === "granted" && (
                <span></span>
              )}

            </button>

            <div className="top-avatar">S</div>

          </div>
        </header>

        {/* PAGE CONTENT */}

        <div className="dashboard-container">

          {activePage === "Calendar" ? (

         <CalendarView
  tasks={tasks}
  onAdd={openCreateModal}
  onEdit={openEditModal}
  onDelete={deleteTask}
  onToggle={toggleTask}
/>

) : activePage === "Shared Reminders" ? (

  <SharedReminders />

) : (

            <>

              {/* WELCOME */}

              <section className="welcome-section">

                <div>
                  <div className="date-label">
                    {today}
                  </div>

                  <h1>
                    Make today <span>count.</span>
                  </h1>

                  <p className="welcome-subtitle">
                    A fresh start, a clear mind, and a little progress.
                  </p>
                </div>

                <div className="welcome-decoration">
                  <div className="sun-circle">
                    <Sun size={36} />
                  </div>

                  <span>One day at a time.</span>
                </div>

              </section>

              {/* STATISTICS */}

              <section className="stats-grid">

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Today's tasks</span>

                    <div className="stat-icon purple-bg">
                      <Target size={19} />
                    </div>
                  </div>

                  <h2>
                    {
                      tasks.filter(
                        (task) => isTaskScheduledOnDate(task, getToday())
                      ).length
                    }
                  </h2>

                  <p>Total responsibilities today</p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Completed</span>

                    <div className="stat-icon green-bg">
                      <CircleCheck size={19} />
                    </div>
                  </div>

                  <h2>{completed}</h2>

                  <p>Look at you go!</p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Remaining</span>

                    <div className="stat-icon orange-bg">
                      <Clock size={19} />
                    </div>
                  </div>

                  <h2>{tasks.length - completed}</h2>

                  <p>You've got this.</p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Daily progress</span>

                    <div className="stat-icon blue-bg">
                      <Flame size={19} />
                    </div>
                  </div>

                  <h2>{progress}%</h2>

                  <p>Keep the momentum!</p>
                </div>

              </section>

              {/* TASKS AND SIDE PANEL */}

              <section className="dashboard-grid">

                <div className="tasks-panel">

                  <div className="section-header">

                    <div>
                      <h2>
                        {activePage === "Overview"
                          ? "Today's focus"
                          : activePage}
                      </h2>

                      <p>
                        Small steps make big differences.
                      </p>
                    </div>

                    <button
                      className="add-button"
                      onClick={() => openCreateModal()}
                    >
                      <Plus size={18} />
                      Add task
                    </button>

                  </div>

                  <div className="task-progress">
                    {/* SMART SEARCH AND FILTERS */}

<div className="reminder-filter-bar">

  <div className="reminder-search-field">

    <Search size={18} />

    <input
      id="remindme-search"
      type="search"
      placeholder="Search reminders..."
      value={searchQuery}
      onChange={(event) =>
        setSearchQuery(event.target.value)
      }
    />

  </div>

  <select
    value={filterCategory}
    onChange={(event) =>
      setFilterCategory(event.target.value)
    }
    aria-label="Filter by category"
  >
    <option value="all">All categories</option>

    {categories.map((category) => (
      <option
        key={category.name}
        value={category.name}
      >
        {category.name}
      </option>
    ))}

  </select>

  <select
    value={filterPriority}
    onChange={(event) =>
      setFilterPriority(event.target.value)
    }
    aria-label="Filter by priority"
  >
    <option value="all">All priorities</option>
    <option value="high">High priority</option>
    <option value="medium">Medium priority</option>
    <option value="low">Low priority</option>
  </select>

  <select
    value={filterStatus}
    onChange={(event) =>
      setFilterStatus(event.target.value)
    }
    aria-label="Filter by status"
  >
    <option value="all">All statuses</option>
    <option value="pending">Pending</option>
    <option value="completed">Completed</option>
  </select>

  <input
    type="date"
    value={filterDate}
    onChange={(event) =>
      setFilterDate(event.target.value)
    }
    aria-label="Filter by date"
  />

  <button
    type="button"
    className="clear-reminder-filters"
    onClick={() => {
      setSearchQuery("");
      setFilterCategory("all");
      setFilterPriority("all");
      setFilterStatus("all");
      setFilterDate("");
    }}
  >
    Clear filters
  </button>

</div>

                    <div className="progress-label">
                      <span>Daily progress</span>

                      <strong>
                        {completed}/{tasks.length} completed
                      </strong>
                    </div>

                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${progress}%`,
                        }}
                      ></div>
                    </div>

                  </div>

                  {/* TASK LIST */}

                  <div className="task-list">

                    {visibleTasks.length === 0 ? (

                      <div className="empty-state">
                        <CheckCircle2 size={35} />
                        <h3>No reminders found</h3>
                        <p>
                          Create a reminder to get started.
                        </p>
                      </div>

                    ) : (

                      visibleTasks.map((task) => (

                        <div
                          className={`task-row ${
                            isTaskDoneOnDate(
                              task,
                              task.repeat && task.repeat !== "none"
                                ? getToday()
                                : task.date
                            )
                              ? "task-done"
                              : ""
                          }`}
                          key={task.id}
                        >

                          <button
                            className={`task-checkbox ${
                              isTaskDoneOnDate(
                                task,
                                task.repeat && task.repeat !== "none"
                                  ? getToday()
                                  : task.date
                              )
                                ? "checked"
                                : ""
                            }`}
                            onClick={() =>
                              toggleTask(
                                task.id,
                                task.repeat && task.repeat !== "none"
                                  ? getToday()
                                  : task.date
                              )
                            }
                          >
                            {isTaskDoneOnDate(
                              task,
                              task.repeat && task.repeat !== "none"
                                ? getToday()
                                : task.date
                            ) && (
                              <CheckCircle2 size={19} />
                            )}
                          </button>

                          <div className="task-details">

                            <h4>{task.title}</h4>

                            {task.description && (
                              <p className="task-description">
                                {task.description}
                              </p>
                            )}

                            <div className="task-meta">
                              <span>{task.category}</span>
                              <span className="meta-dot">·</span>
                              <span>
                                {task.date || "No date"}
                              </span>
                              <span className="meta-dot">·</span>
                              <span>
                                {formatTime(task.time)}
                              </span>
                              {task.repeat && task.repeat !== "none" && (
                                <>
                                  <span className="meta-dot">·</span>
                                  <span>Repeats {task.repeat}</span>
                                </>
                              )}
                            </div>
                          <SubtasksPanel reminderId={task.id} />

<AttachmentPanel reminderId={task.id} />

<FocusMode task={task} />
                          </div>

                          <span
                            className={`priority ${
                              (task.priority || "Medium").toLowerCase()
                            }`}
                          >
                            {task.priority}
                          </span>
                          {task.time && (
  <details className="task-snooze-menu">

    <summary title="Snooze reminder">
      <Clock size={16} />
    </summary>

    <div className="task-snooze-options">

      {[5, 10, 30, 60].map((minutes) => (
        <button
          type="button"
          key={minutes}
          onClick={(event) => {
            event.currentTarget.closest(
              "details"
            ).open = false;

            snoozeTask(task.id, minutes);
          }}
        >
          {minutes} minutes
        </button>
      ))}

    </div>

  </details>
)}

                          <button
                            className="task-more"
                            onClick={() =>
                              openEditModal(task)
                            }
                            title="Edit reminder"
                          >
                            <Pencil size={16} />
                          </button>
                          <ShareReminderButton reminder={task} />

                          <button
                            className="task-more"
                            onClick={() =>
                              deleteTask(task.id)
                            }
                            title="Delete reminder"
                          >
                            <Trash2 size={17} />
                          </button>

                        </div>

                      ))

                    )}

                  </div>

                  <button
                    className="view-all"
                    onClick={() =>
                      setActivePage("My Tasks")
                    }
                  >
                    View all tasks
                    <ArrowUpRight size={16} />
                  </button>

                </div>

                {/* RIGHT PANEL */}

                <div className="right-column">

                  <div className="motivation-card">

                    <div className="motivation-top">
                      <Sparkles size={19} />
                      A LITTLE REMINDER
                    </div>

                    <h2>
                      You don't have to do it all.
                      Just start somewhere.
                    </h2>

                    <div className="motivation-footer">
                      <span>
                        Keep going, you're doing great.
                      </span>

                      <div className="heart">♥</div>
                    </div>

                  </div>

                  {/* UPCOMING REMINDERS */}

                  <div className="upcoming-panel">

                    <div className="section-header">

                      <div>
                        <h2>Coming up</h2>
                        <p>
                          Don't let these slip away.
                        </p>
                      </div>

                      <CalendarDays size={20} />

                    </div>

                    {tasks
                      .map((task) => ({
                        ...task,
                        nextOccurrenceDate: getNextOccurrenceDate(task),
                      }))
                      .filter((task) => task.nextOccurrenceDate)
                      .sort((a, b) => {
                        const dateA =
                          `${a.nextOccurrenceDate}T${a.time || "23:59"}`;

                        const dateB =
                          `${b.nextOccurrenceDate}T${b.time || "23:59"}`;

                        return dateA.localeCompare(dateB);
                      })
                      .slice(0, 3)
                      .map((task) => {

                        const eventDate = fromISODate(
                          task.nextOccurrenceDate
                        );

                        return (
                          <div
                            className="upcoming-event"
                            key={task.id}
                          >

                            <div className="event-date purple-event">
                              <strong>
                                {eventDate.getDate()}
                              </strong>

                              <span>
                                {eventDate
                                  .toLocaleDateString("en-US", {
                                    month: "short",
                                  })
                                  .toUpperCase()}
                              </span>
                            </div>

                            <div>
                              <h4>{task.title}</h4>

                              <p>
                                {task.category} ·{" "}
                                {formatTime(task.time)}
                              </p>
                            </div>

                          </div>
                        );
                      })}

                  </div>

                </div>

              </section>

              <footer className="dashboard-footer">
                <span>
                  Made for your everyday moments.
                </span>

                <span>RemindMe. © 2026</span>
              </footer>

            </>

          )}

        </div>

      </main>

      {/* CREATE / EDIT REMINDER MODAL */}

      {showModal && (

        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false);
              setEditingTaskId(null);
            }
          }}
        >

          <form
            className="task-modal"
            onSubmit={saveTask}
          >

            <div className="modal-header">

              <h2>
                {editingTaskId !== null
                  ? "Edit reminder"
                  : "Create a reminder"}
              </h2>

              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingTaskId(null);
                }}
              >
                ✕
              </button>

            </div>

           <label>Reminder title *</label>

<input
  type="text"
  placeholder="What do you need to remember?"
  value={newTask.title}
  onChange={(e) =>
    setNewTask({
      ...newTask,
      title: e.target.value,
    })
  }
  required
  autoFocus
/>

<VoiceInput
  onTranscript={(transcript) => {
    setNewTask((previous) => ({
      ...previous,
      title: transcript,
    }));
  }}
/>
            <label>Description</label>

            <textarea
              placeholder="Add some details (optional)"
              value={newTask.description}
              onChange={(e) =>
                setNewTask({
                  ...newTask,
                  description: e.target.value,
                })
              }
              rows="3"
            />

            <div className="form-row">

              <div>
                <label>Date *</label>

                <input
                  type="date"
                  value={newTask.date}
                  min={getToday()}
                  onChange={(e) =>
                    setNewTask({
                      ...newTask,
                      date: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div>
                <label>Time</label>

                <input
                  type="time"
                  value={newTask.time}
                  onChange={(e) =>
                    setNewTask({
                      ...newTask,
                      time: e.target.value,
                    })
                  }
                />
              </div>

            </div>

            <div className="form-row">

              <div>
                <label>Category</label>

                <select
                  value={newTask.category}
                  onChange={(e) =>
                    setNewTask({
                      ...newTask,
                      category: e.target.value,
                    })
                  }
                >
                  <option value="Study">Study</option>
                  <option value="Work">Work</option>
                  <option value="Family">Family</option>
                  <option value="Personal">Personal</option>
                </select>
              </div>

              <div>
                <label>Priority</label>

                <select
                  value={newTask.priority}
                  onChange={(e) =>
                    setNewTask({
                      ...newTask,
                      priority: e.target.value,
                    })
                  }
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

            </div>

            <div className="form-row">
              <div>
                <label>Repeat</label>
                <select
                  value={newTask.repeat || "none"}
                  onChange={(e) =>
                    setNewTask({
                      ...newTask,
                      repeat: e.target.value,
                    })
                  }
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Every day</option>
                  <option value="weekly">Every week</option>
                  <option value="monthly">Every month</option>
                </select>
              </div>
              <div className="repeat-help">
                <span>Repeating reminders continue until you delete them.</span>
              </div>
            </div>

            <button
              className="add-button modal-submit"
              type="submit"
            >
              {editingTaskId !== null
                ? <Pencil size={18} />
                : <Plus size={18} />}

              {editingTaskId !== null
                ? "Save changes"
                : "Create reminder"}
            </button>

          </form>

        </div>

      )}

    </div>
  );
}

export default App;