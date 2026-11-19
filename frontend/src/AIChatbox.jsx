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

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  content:
    "Hey! I'm Remy, your personal productivity assistant. ✨\n\nI can help you organize your day, plan your studies, understand your reminders and stay productive.\n\nWhat would you like help with today?",
  localOnly: true,
};

const STARTER_PROMPTS = [
  "What are my reminders?",
  "Help me plan my day",
  "Create a study timetable",
  "How can I improve my productivity?",
];

function createMessage(role, content) {
  return {
    id: `${Date.now()}-${Math.random()}`,
    role,
    content,
  };
}

export default function AIChatbox() {
  const [isOpen, setIsOpen] = useState(false);

  const [messages, setMessages] = useState([
    WELCOME_MESSAGE,
  ]);

  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Open Remy using the left sidebar card.
  useEffect(() => {
    const openRemy = () => setIsOpen(true);

    window.addEventListener("remy:open", openRemy);

    return () => {
      window.removeEventListener("remy:open", openRemy);
    };
  }, []);

  // Automatically scroll to the latest message.
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [messages, isLoading, isOpen]);

  // Focus input when chat opens.
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Send message to local Remy AI.
  const sendMessage = async (text) => {
    const messageText = text.trim();

    if (!messageText || isLoading) return;

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

    setMessages((previous) => [
      ...previous,
      createMessage("user", messageText),
    ]);

    setDraft("");
    setIsLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/ai/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: messageText,
            history,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || "Unable to contact Remy."
        );
      }

      if (!result.reply) {
        throw new Error("Remy returned an empty response.");
      }

      setMessages((previous) => [
        ...previous,
        createMessage("assistant", result.reply),
      ]);

    } catch (error) {
      console.error("Remy chat error:", error);

      setMessages((previous) => [
        ...previous,
        createMessage(
          "assistant",
          `Sorry, something went wrong. ${error.message}`
        ),
      ]);

    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(draft);
  };

  const clearConversation = () => {
    if (isLoading) return;
    setMessages([WELCOME_MESSAGE]);
  };

  const hasConversation = messages.some(
    (message) => !message.localOnly
  );

  // IMPORTANT:
  // No floating launcher is rendered.
  // Remy opens only from the sidebar card.
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
          >
            <Trash2 size={17} />
          </button>

          <button
            onClick={() => setIsOpen(false)}
            title="Minimize chat"
          >
            <ChevronDown size={20} />
          </button>

          <button
            onClick={() => setIsOpen(false)}
            title="Close chat"
          >
            <X size={19} />
          </button>
        </div>
      </header>

      {/* MESSAGES */}

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

        {/* STARTER QUESTIONS */}

        {!hasConversation && (
          <div className="remy-starter-section">
            <p>Try asking me</p>

            <div className="remy-starter-list">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={isLoading}
                >
                  <Sparkles size={13} />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TYPING INDICATOR */}

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

      {/* MESSAGE INPUT */}

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
            Powered by local AI
          </span>

          <span>Llama 3.2 · Private on your device</span>
        </div>
      </div>
    </section>
  );
}