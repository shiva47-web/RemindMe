import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, AlertCircle } from "lucide-react";
import "./VoiceInput.css";

const LANGUAGES = [
  { label: "English", value: "en-IN" },
  { label: "Tamil", value: "ta-IN" },
  { label: "Hindi", value: "hi-IN" },
];

export default function VoiceInput({
  onTranscript,
  disabled = false,
}) {
  const recognitionRef = useRef(null);

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState("en-IN");
  const [error, setError] = useState("");
  const [lastTranscript, setLastTranscript] = useState("");

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    setSupported(Boolean(SpeechRecognition));
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Voice input is not supported in this browser.");
      return;
    }

    setError("");
    setLastTranscript("");

    const recognition = new SpeechRecognition();

    recognition.lang = language;
    recognition.continuous = false;

    // IMPORTANT: Enable live/interim speech results.
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event) => {
      let transcript = "";

      // Collect both interim and final recognized words.
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      transcript = transcript.trim();

      if (transcript) {
        setLastTranscript(transcript);

        // Immediately update the reminder title input.
        onTranscript?.(transcript);
      }
    };

    recognition.onerror = (event) => {
      const messages = {
        "not-allowed":
          "Microphone permission denied. Allow microphone access.",
        "service-not-allowed":
          "Speech recognition service is unavailable.",
        "no-speech":
          "No speech detected. Please try again.",
        network:
          "Speech recognition needs an internet connection.",
        "audio-capture":
          "No working microphone was detected.",
        aborted:
          "Voice input was stopped.",
      };

      if (event.error !== "aborted") {
        setError(
          messages[event.error] ||
            `Voice input error: ${event.error}`
        );
      }
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (startError) {
      recognitionRef.current = null;
      setListening(false);
      setError("Could not start voice input. Please try again.");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setListening(false);
  };

  return (
    <div className="voice-input-wrapper">
      <div className="voice-input-controls">
        <select
          className="voice-language"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          disabled={listening || disabled}
          aria-label="Voice input language"
        >
          {LANGUAGES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={`voice-input-button ${
            listening ? "voice-listening" : ""
          }`}
          onClick={listening ? stopListening : startListening}
          disabled={disabled || !supported}
          title={listening ? "Stop listening" : "Start voice input"}
        >
          {listening ? (
            <MicOff size={17} />
          ) : (
            <Mic size={17} />
          )}

          {listening ? "Stop" : "Speak"}
        </button>
      </div>

      {listening && (
        <div className="voice-listening-status">
          <span className="voice-pulse" />
          Listening... Speak now.
        </div>
      )}

      {lastTranscript && (
        <p className="voice-transcript">
          Recognized: {lastTranscript}
        </p>
      )}

      {error && (
        <p className="voice-error">
          <AlertCircle size={14} />
          {error}
        </p>
      )}

      {!supported && (
        <p className="voice-error">
          Your browser does not support voice input.
          Try Chrome or Edge.
        </p>
      )}
    </div>
  );
}