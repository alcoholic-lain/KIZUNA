import { Mic, MicOff, Send, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, CardTitle, Input } from "./ui";
import type { RealtimeItem, RealtimeSession as RealtimeSessionType } from "@openai/agents/realtime";

type Message = { role: "user" | "assistant"; content: string };
type VoiceContext = {
  source: "measured" | "simulated";
  today_kwh: number;
  today_expected_kwh: number;
  month_forecast_kwh: number;
  monthly_goal_kwh: number;
  risk: string;
  predicted_peak: { date: string; from: number; to: number; confidence: number };
  weather: {
    available: boolean;
    date?: string;
    condition?: string;
    max_c?: number;
    min_c?: number;
    apparent_max_c?: number;
    humidity_max?: number;
    precipitation_probability?: number;
    detail?: string;
  };
  factors: string[];
  actions: { title: string; reason: string }[];
};
type EphemeralCredential = { value: string; expires_at: number; model: string };

const AGENT_INSTRUCTIONS = `You are WATT'FLOW, a friendly English-first voice energy coach for the user's household.
Speak naturally and briefly, usually one to three sentences. Ask a short follow-up if it will help personalize advice.
Call get_energy_context when the user asks about their own usage, forecast, risk, peak, weather, or recommendations. Treat tool results as the only source for household-specific facts. Clearly distinguish measured or simulated readings from forecasts and estimates. Never invent weather, device information, usage, confidence, or savings.
Give practical and affordable advice while preserving health and comfort. Never recommend turning off refrigerators, medical devices, safety equipment, or essential systems. Never claim authority to control appliances. You have no device-control tools and must not imply an action was executed. Energy Tokens are virtual rewards, not electricity credits. If information is missing, say so plainly.`;

function transcriptMessages(history: RealtimeItem[]): Message[] {
  return history.flatMap((item) => {
    if (item.type !== "message" || item.role === "system" || item.status !== "completed") return [];
    const content = item.content.map((part) => {
      if ("text" in part) return part.text;
      if ("transcript" in part) return part.transcript || "";
      return "";
    }).join(" ").trim();
    return content ? [{ role: item.role, content }] : [];
  }).slice(-12);
}

export function EnergyChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [consent, setConsent] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<RealtimeSessionType | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => () => {
    sessionRef.current?.close();
    sessionRef.current = null;
  }, []);

  const start = async () => {
    if (!consent || connecting || connected) return;
    setConnecting(true);
    setError("");
    setStatus("Preparing a secure voice session…");
    let session: RealtimeSessionType | null = null;
    try {
      const credential = await api<EphemeralCredential>("ai/realtime-token", {
        method: "POST",
        body: { consent: true },
      });
      const [{ tool }, { RealtimeAgent, RealtimeSession }, { z }] = await Promise.all([
        import("@openai/agents"),
        import("@openai/agents/realtime"),
        import("zod"),
      ]);
      const getEnergyContext = tool({
        name: "get_energy_context",
        description: "Read a brief current energy forecast and safe recommendations for the signed-in user. Call when a question needs household-specific information.",
        parameters: z.object({}),
        async execute() {
          const facts = await api<VoiceContext>("ai/voice-context");
          return JSON.stringify(facts);
        },
      });
      const agent = new RealtimeAgent({
        name: "WATT'FLOW Energy Coach",
        instructions: AGENT_INSTRUCTIONS,
        tools: [getEnergyContext],
      });
      session = new RealtimeSession(agent, {
        model: credential.model,
        tracingDisabled: true,
        config: {
          outputModalities: ["audio"],
          reasoning: { effort: "low" },
          audio: {
            input: {
              format: "pcm16",
              transcription: { model: "gpt-live-transcribe", languages: ["en"] },
            },
            output: { format: "pcm16" },
          },
        },
      });
      session.on("history_updated", (history) => setMessages(transcriptMessages(history)));
      session.on("audio_start", () => setStatus("WATT'FLOW is speaking…"));
      session.on("audio_stopped", () => setStatus("Connected — you can speak whenever you’re ready."));
      session.on("agent_tool_start", () => setStatus("Checking your latest energy forecast…"));
      session.on("error", () => setError("The live voice session encountered an error. Please reconnect."));
      sessionRef.current = session;
      await session.connect({ apiKey: credential.value });
      setConnected(true);
      setStatus("Connected — speak naturally or type a message.");
    } catch (reason) {
      session?.close();
      sessionRef.current = null;
      setConnected(false);
      setError(reason instanceof Error ? reason.message : "Could not start the live voice session.");
      setStatus("");
    } finally {
      setConnecting(false);
    }
  };

  const stop = () => {
    sessionRef.current?.close();
    sessionRef.current = null;
    setConnected(false);
    setMuted(false);
    setStatus("Voice session ended.");
  };

  const toggleMute = () => {
    const session = sessionRef.current;
    if (!session) return;
    if (session.muted === null) {
      setError("Microphone muting is not supported by this browser transport.");
      return;
    }
    const nextMuted = !session.muted;
    session.mute(nextMuted);
    setMuted(nextMuted);
  };

  const sendText = (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !sessionRef.current) return;
    sessionRef.current.sendMessage(text);
    setDraft("");
    setError("");
    setStatus("WATT'FLOW is responding…");
  };

  return (
    <Card>
      <CardTitle>Live voice energy agent</CardTitle>
      {!connected ? (
        <div className="grid gap-4">
          <p className="text-sm leading-relaxed text-ink-2">
            Have a natural, spoken conversation in English. WATT’FLOW can check your forecast and give safe, personalized energy advice.
          </p>
          <label className="flex items-start gap-3 rounded-xl border border-line bg-muted/60 p-3 text-xs leading-relaxed text-ink-2">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand)]"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>
              I agree to send my live voice or typed messages and a brief energy summary (usage estimate, peak, weather and advice) to OpenAI to operate this session. My name, exact address, precise location and raw usage history are not included. OpenAI Realtime usage may incur charges.
            </span>
          </label>
          <Button className="w-full" variant="brand" disabled={!consent || connecting} onClick={start}>
            <Mic />{connecting ? "Connecting…" : "Start live voice session"}
          </Button>
          <p className="text-xs leading-relaxed text-ink-3">
            Microphone access is requested by your browser. The agent has read-only energy tools; it cannot switch or configure appliances. Use HTTPS or localhost.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-good" role="status">{status || "Connected"}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={toggleMute}><>{muted ? <MicOff /> : <Mic />}{muted ? "Unmute" : "Mute"}</></Button>
              <Button size="sm" variant="danger" onClick={stop}><Square />End session</Button>
            </div>
          </div>
          <div ref={listRef} aria-live="polite" className="grid max-h-72 gap-3 overflow-y-auto rounded-xl bg-muted/60 p-3">
            {messages.length === 0 && <p className="text-sm text-ink-3">Listening — ask about your energy peak, usage, weather, or what you can do to prepare.</p>}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === "user" ? "bg-ink text-bg" : "border border-line bg-card text-ink"
                }`}>{message.content}</p>
              </div>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={sendText}>
            <Input value={draft} maxLength={500} onChange={(event) => setDraft(event.target.value)} placeholder="Or type a message in English…" aria-label="Message to WATT'FLOW" />
            <Button type="submit" disabled={!draft.trim()} aria-label="Send message"><Send /></Button>
          </form>
        </div>
      )}
      {status && !connected && <p className="mt-2 text-xs text-ink-3" role="status">{status}</p>}
      {error && <p className="mt-2 text-xs text-bad" role="alert">{error}</p>}
    </Card>
  );
}
