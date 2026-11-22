import { Mic, Send, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, CardTitle, Input } from "./ui";

type Message = { role: "user" | "assistant"; content: string };

const GREETING: Message = {
  role: "assistant",
  content: "Hi! I’m Watt’Flow’s energy assistant. Ask me about your predicted peak, energy use, weather, monthly goal, or practical ways to prepare.",
};

export function EnergyChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const sendMessage = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    const next = [...messages, { role: "user" as const, content: text }].slice(-12);
    setMessages(next);
    setDraft("");
    setError("");
    setSending(true);
    try {
      const result = await api<{ reply: string }>("ai/chat", {
        method: "POST",
        body: { messages: next },
      });
      setMessages((current) => [...current, { role: "assistant" as const, content: result.reply }].slice(-12));
      if (speakReplies && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(result.reply);
        utterance.lang = "en-US";
        window.speechSynthesis.speak(utterance);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The assistant could not answer. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const listen = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Voice input is not supported in this browser. You can still type your question.");
      return;
    }
    setError("");
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = (event: any) => {
      setListening(false);
      setError(event.error === "not-allowed"
        ? "Microphone permission was denied. Allow microphone access or type your question."
        : "Voice recognition failed. Please try again or type your question.");
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) void sendMessage(transcript);
    };
    try {
      recognition.start();
    } catch {
      setListening(false);
      setError("Could not start voice recognition. Please try again or type your question.");
    }
  };

  return (
    <Card>
      <CardTitle right={
        <button
          type="button"
          onClick={() => setSpeakReplies((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-2 hover:bg-muted"
          aria-label={speakReplies ? "Turn spoken replies off" : "Turn spoken replies on"}
        >
          {speakReplies ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          {speakReplies ? "Voice on" : "Voice off"}
        </button>
      }>Chat with Watt’Flow</CardTitle>
      <div
        ref={listRef}
        aria-live="polite"
        className="grid max-h-80 gap-3 overflow-y-auto rounded-xl bg-muted/60 p-3"
      >
        {[GREETING, ...messages].map((message, index) => (
          <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <p className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              message.role === "user" ? "bg-ink text-bg" : "border border-line bg-card text-ink"
            }`}>
              {message.content}
            </p>
          </div>
        ))}
        {sending && <p className="text-xs text-ink-3">Checking your energy information…</p>}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void sendMessage(draft); }}>
        <Input
          value={draft}
          maxLength={500}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask in English about your energy…"
          aria-label="Message to Watt’Flow"
          disabled={sending}
        />
        <Button type="button" variant={listening ? "brand" : "outline"} onClick={listen} disabled={sending || listening} aria-label="Speak your question">
          <Mic />
        </Button>
        <Button type="submit" disabled={sending || !draft.trim()} aria-label="Send message"><Send /></Button>
      </form>
      {error && <p role="alert" className="mt-2 text-xs text-bad">{error}</p>}
      <p className="mt-3 text-xs leading-relaxed text-ink-3">
        Replies use your app’s energy data on this server; chat messages are not sent to an external AI provider.
        Voice transcription is handled by your browser, so type instead if you prefer not to use it.
      </p>
    </Card>
  );
}
