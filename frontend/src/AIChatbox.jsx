
import { useEffect, useRef, useState } from "react";

import {
  Bot,
  Send,
  Sparkles,
  Trash2,
  X,
  ChevronDown,
} from "lucide-react";

import "./AIChatbox.css";

// =====================================================
// REMY API CONFIGURATION
// =====================================================

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "https://remindme-api-6sfw.onrender.com"
).replace(/\/+$/, "");

const CHAT_ENDPOINT = `${API_URL}/api/ai/chat`;

// =====================================================
// WELCOME MESSAGE
// =====================================================

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  content:
    "Hey! I'm Remy, your personal productivity assistant. ✨\n\nI can help you organize your day, plan your studies, understand your reminders and stay productive.\n\nWhat would you like help with today?",
  localOnly: true,
};

// =====================================================
// STARTER PROMPTS
// =====================================================

const STARTER_PROMPTS = [
  "What are my reminders?",
  "Help me plan my day",
  "Create a study timetable",
  "How can I improve my productivity?",
];

// =====================================================
// MESSAGE CREATOR
// =====================================================

function createMessage(role, content) {
  return {
    id: `${Date.now()}-${Math.random()}`,
    role,
    content,
  };
}

// =====================================================
// REMY CHATBOX COMPONENT
// =====================================================

export default function AIChatbox() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    WELCOME_MESSAGE,
  ]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ===================================================
  // OPEN REMY
  // ===================================================

  useEffect(() => {
    const openRemy = () => setIsOpen(true);

    window.addEventListener("remy:open", openRemy);

    return () => {
      window.removeEventListener("remy:open", openRemy);
    };
  }, []);

  // ===================================================
  // AUTO SCROLL
  // ===================================================

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [messages, isLoading, isOpen]);

  // ===================================================
  // AUTO FOCUS
  // ===================================================

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // ===================================================
  // SEND MESSAGE TO REMY
  // ===================================================

  const sendMessage = async (text) => {
    const messageText = text.trim();

    if (!messageText || isLoading) return;

    // Get authentication token
    const token = localStorage.getItem(
      "remindme_access_token"
    );

    if (!token) {
      setMessages((previous) => [
        ...previous,
        createMessage(
          "assistant",
          "Your login session is missing. Please log in again."
        ),
      ]);

      return;
    }

    // Prepare conversation history
    const history = messages
      .filter(
        (message) =>
          !message.localOnly &&
          (message.role === "user" ||
            message.role === "assistant")
      )
      .slice(-8)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    // Display user message
    setMessages((previous) => [
      ...previous,
      createMessage("user", messageText),
    ]);

    setDraft("");
    setIsLoading(true);

    try {
      console.log("Remy API:", CHAT_ENDPOINT);

      // Connect to hosted backend
      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          message: messageText,
          history,
        }),
      });

      // Read backend response
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail ||
            `Remy request failed (${response.status})`
        );
      }

      if (!result.reply) {
        throw new Error(
          "Remy returned an empty response."
        );
      }

      // Display Remy's reply
      setMessages((previous) => [
        ...previous,
        createMessage("assistant", result.reply),
      ]);
    } catch (error) {
      console.error("Remy chat error:", error);

      let errorMessage = error.message;

      if (
        error instanceof TypeError &&
        error.message.toLowerCase().includes("fetch")
      ) {
        errorMessage =
          "Cannot connect to Remy. Please check your internet connection and backend server.";
      }

      setMessages((previous) => [
        ...previous,
        createMessage(
          "assistant",
          `Sorry, something went wrong. ${errorMessage}`
        ),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ===================================================
  // FORM SUBMISSION
  // ===================================================

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(draft);
  };

  // ===================================================
  // CLEAR CONVERSATION
  // ===================================================

  const clearConversation = () => {
    if (isLoading) return;

    setMessages([WELCOME_MESSAGE]);
  };

  // ===================================================
  // CONVERSATION CHECK
  // ===================================================

  const hasConversation = messages.some(
    (message) => !message.localOnly
  );

  // ===================================================
  // CHAT PANEL
  // ===================================================

  if (!isOpen) {
    return null;
  }

  return (
    <section
      className="remy-chat-panel"
      role="dialog"
      aria-label="Remy AI Assistant"
    >
      {/* HEADER */}

      <header className="remy-chat-header">
        <div className="remy-header-identity">
          <div className="remy-avatar">
            <Bot size={23} />
            <span />
          </div>

          <div className="remy-header-text">
            <h3>Remy</h3>

            <p>
              <span className="remy-status-dot" />
              Your AI productivity assistant
            </p>
          </div>
        </div>

        <div className="remy-header-actions">
          <button
            onClick={clearConversation}
            title="Clear conversation"
            disabled={isLoading}
            type="button"
          >
            <Trash2 size={17} />
          </button>

          <button
            onClick={() => setIsOpen(false)}
            title="Minimize chat"
            type="button"
          >
            <ChevronDown size={20} />
          </button>

          <button
            onClick={() => setIsOpen(false)}
            title="Close chat"
            type="button"
          >
            <X size={19} />
          </button>
        </div>
      </header>

      {/* CHAT MESSAGES */}

      <div className="remy-chat-messages">
        <div className="remy-chat-date">
          YOUR PERSONAL AI ASSISTANT
        </div>

        {messages.map((message) => (
          <div
            key={message.id}
            className={`remy-message-row ${
              message.role === "user"
                ? "remy-user-row"
                : "remy-assistant-row"
            }`}
          >
            {message.role === "assistant" && (
              <div className="remy-message-avatar">
                <Sparkles size={15} />
              </div>
            )}

            <div
              className={`remy-message-bubble ${
                message.role === "user"
                  ? "remy-user-bubble"
                  : "remy-assistant-bubble"
              }`}
            >
              <div className="remy-message-content">
                {message.content}
              </div>
            </div>
          </div>
        ))}

        {/* STARTER PROMPTS */}

        {!hasConversation && (
          <div className="remy-starter-section">
            <p>Try asking me</p>

            <div className="remy-starter-list">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={isLoading}
                  type="button"
                >
                  <Sparkles size={13} />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* LOADING ANIMATION */}

        {isLoading && (
          <div className="remy-message-row remy-assistant-row">
            <div className="remy-message-avatar">
              <Sparkles size={15} />
            </div>

            <div className="remy-typing">
              <span />
              <span />
              <span />
              <small>Remy is thinking...</small>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* CHAT FOOTER */}

      <div className="remy-chat-footer">
        <form
          className="remy-input-form"
          onSubmit={handleSubmit}
        >
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) =>
              setDraft(event.target.value)
            }
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey
              ) {
                event.preventDefault();
                handleSubmit(event);
              }
            }}
            placeholder="Ask Remy anything..."
            rows={1}
            maxLength={2000}
            disabled={isLoading}
          />

          <button
            type="submit"
            disabled={!draft.trim() || isLoading}
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </form>

        <div className="remy-footer-note">
          <span>
            <Sparkles size={12} />
            Powered by cloud AI
          </span>

          <span>
            Remy · AI productivity assistant
          </span>
        </div>
      </div>
    </section>
  );
}
