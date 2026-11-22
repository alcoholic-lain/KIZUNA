import { Mic, MicOff, Send, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, CardTitle, Input } from "./ui";
import captureWorkletUrl from "./audio-capture-worklet.js?url&no-inline";

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
type EphemeralCredential = { value: string; expires_at: string; model: string };
type LiveTranscription = { text?: string; finished?: boolean };
type LiveMessage = {
  setupComplete?: unknown;
  error?: { message?: string };
  toolCall?: {
    functionCalls?: Array<{ id: string; name: string; args?: Record<string, unknown> }>;
  };
  serverContent?: {
    modelTurn?: { parts?: Array<{ inlineData?: { data?: string }; text?: string }> };
    inputTranscription?: LiveTranscription;
    interimInputTranscription?: LiveTranscription;
    outputTranscription?: LiveTranscription;
    interrupted?: boolean;
    turnComplete?: boolean;
  };
};

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const AGENT_INSTRUCTIONS = `You are WATT'FLOW, a friendly English-first voice energy coach for the user's household.
Speak naturally and briefly, usually one to three sentences. Ask a short follow-up if it will help personalize advice.
Call get_energy_context when the user asks about their own usage, forecast, risk, peak, weather, or recommendations. Treat tool results as the only source for household-specific facts. Clearly distinguish measured or simulated readings from forecasts and estimates. Never invent weather, device information, usage, confidence, or savings.
Give practical and affordable advice while preserving health and comfort. Never recommend turning off refrigerators, medical devices, safety equipment, or essential systems. Never claim authority to control appliances. You have no device-control tools and must not imply an action was executed. Energy Tokens are virtual rewards, not electricity credits. If information is missing, say so plainly.`;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function EnergyChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [consent, setConsent] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [draft, setDraft] = useState("");
  const [partialUser, setPartialUser] = useState("");
  const [partialAssistant, setPartialAssistant] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const captureSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const captureNodeRef = useRef<AudioWorkletNode | null>(null);
  const playbackSourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const nextPlaybackTimeRef = useRef(0);
  const inputTranscriptRef = useRef("");
  const outputTranscriptRef = useRef("");

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, partialUser, partialAssistant, status]);

  const stopPlayback = useCallback(() => {
    for (const source of playbackSourcesRef.current) {
      try {
        source.stop();
      } catch (reason) {
        console.error("Could not stop a Gemini audio chunk.", reason);
      }
    }
    playbackSourcesRef.current.clear();
    nextPlaybackTimeRef.current = outputContextRef.current?.currentTime ?? 0;
  }, []);

  const cleanupVoice = useCallback((closeSocket = true, clearTranscript = true) => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (closeSocket && socket && socket.readyState < WebSocket.CLOSING) socket.close();

    stopPlayback();
    captureSourceRef.current?.disconnect();
    captureNodeRef.current?.disconnect();
    captureSourceRef.current = null;
    captureNodeRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    for (const context of [inputContextRef.current, outputContextRef.current]) {
      if (context && context.state !== "closed") {
        void context.close().catch((reason) => console.error("Could not close audio context.", reason));
      }
    }
    inputContextRef.current = null;
    outputContextRef.current = null;
    inputTranscriptRef.current = "";
    outputTranscriptRef.current = "";
    if (clearTranscript) {
      setPartialUser("");
      setPartialAssistant("");
    }
  }, [stopPlayback]);

  useEffect(() => () => cleanupVoice(true, false), [cleanupVoice]);

  const playAudio = (base64Audio: string) => {
    const context = outputContextRef.current;
    if (!context) return;
    const binary = atob(base64Audio);
    if (binary.length % 2 !== 0) throw new Error("Gemini returned malformed PCM audio.");
    const pcm = new DataView(new ArrayBuffer(binary.length));
    for (let index = 0; index < binary.length; index += 1) {
      pcm.setUint8(index, binary.charCodeAt(index));
    }
    const samples = new Float32Array(binary.length / 2);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = pcm.getInt16(index * 2, true) / 32768;
    }

    const buffer = context.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => playbackSourcesRef.current.delete(source);
    const startAt = Math.max(context.currentTime, nextPlaybackTimeRef.current);
    source.start(startAt);
    nextPlaybackTimeRef.current = startAt + buffer.duration;
    playbackSourcesRef.current.add(source);
    setStatus("Gemini is speaking…");
  };

  const updateTranscript = (role: "user" | "assistant", transcript: LiveTranscription) => {
    const text = transcript.text || "";
    const accumulator = role === "user" ? inputTranscriptRef : outputTranscriptRef;
    const setPartial = role === "user" ? setPartialUser : setPartialAssistant;
    if (text) accumulator.current += text;
    setPartial(accumulator.current);
    if (!transcript.finished) return;

    const content = accumulator.current.trim();
    if (content) setMessages((current) => [...current, { role, content }].slice(-12));
    accumulator.current = "";
    setPartial("");
  };

  const handleLiveMessage = async (socket: WebSocket, message: LiveMessage) => {
    if (message.error?.message) {
      setError(`Gemini Live: ${message.error.message}`);
      setStatus("");
      return;
    }

    const serverContent = message.serverContent;
    if (serverContent?.interimInputTranscription?.text) {
      setPartialUser(serverContent.interimInputTranscription.text);
    }
    if (serverContent?.inputTranscription) {
      updateTranscript("user", serverContent.inputTranscription);
    }
    if (serverContent?.outputTranscription) {
      updateTranscript("assistant", serverContent.outputTranscription);
    }
    for (const part of serverContent?.modelTurn?.parts || []) {
      if (part.inlineData?.data) playAudio(part.inlineData.data);
    }
    if (serverContent?.interrupted) {
      stopPlayback();
      setStatus("Connected — speak whenever you’re ready.");
    }
    if (serverContent?.turnComplete) {
      setStatus("Connected — speak whenever you’re ready.");
    }

    const functionCalls = message.toolCall?.functionCalls || [];
    if (!functionCalls.length || socket.readyState !== WebSocket.OPEN) return;
    setStatus("Checking your latest energy forecast…");
    const functionResponses = await Promise.all(functionCalls.map(async (call) => {
      if (call.name !== "get_energy_context") {
        return { id: call.id, name: call.name, response: { error: "Unknown tool." } };
      }
      try {
        const facts = await api<VoiceContext>("ai/voice-context");
        return { id: call.id, name: call.name, response: { result: facts } };
      } catch (reason) {
        const detail = reason instanceof Error ? reason.message : "The energy summary could not be loaded.";
        setError(detail);
        return { id: call.id, name: call.name, response: { error: "Energy context is unavailable." } };
      }
    }));
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ toolResponse: { functionResponses } }));
    }
  };

  const start = async () => {
    if (!consent || connecting || connected) return;
    setConnecting(true);
    setError("");
    setStatus("Preparing a secure Gemini Live session…");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access requires HTTPS or localhost in a supported browser.");
      }

      const inputContext = new AudioContext();
      const outputContext = new AudioContext();
      inputContextRef.current = inputContext;
      outputContextRef.current = outputContext;
      await Promise.all([inputContext.resume(), outputContext.resume()]);
      await inputContext.audioWorklet.addModule(captureWorkletUrl);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      mediaStreamRef.current = mediaStream;

      const credential = await api<EphemeralCredential>("ai/gemini-live-token", {
        method: "POST",
        body: { consent: true },
      });
      const socket = new WebSocket(
        `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(credential.value)}`,
      );
      socketRef.current = socket;

      let setupTimer = 0;
      let setupComplete = false;
      const setupReady = new Promise<void>((resolve, reject) => {
        const rejectSetup = (reason: Error) => {
          if (setupComplete) return;
          setupComplete = true;
          window.clearTimeout(setupTimer);
          reject(reason);
        };
        setupTimer = window.setTimeout(
          () => rejectSetup(new Error("Gemini Live did not finish setup. Check the API key and model access.")),
          20000,
        );
        socket.onopen = () => {
          socket.send(JSON.stringify({
            setup: {
              model: `models/${credential.model}`,
              generationConfig: { responseModalities: ["AUDIO"] },
              systemInstruction: { parts: [{ text: AGENT_INSTRUCTIONS }] },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              tools: [{
                functionDeclarations: [{
                  name: "get_energy_context",
                  description: "Read a brief current energy forecast and safe recommendations for the signed-in user. Call when a question needs household-specific information.",
                  parameters: { type: "OBJECT", properties: {} },
                }],
              }],
            },
          }));
          setStatus("Connecting to Gemini Live…");
        };
        socket.onmessage = async (event) => {
          try {
            const raw = event.data instanceof Blob ? await event.data.text() : String(event.data);
            const message = JSON.parse(raw) as LiveMessage;
            if (message.error?.message && !setupComplete) {
              rejectSetup(new Error(`Gemini Live: ${message.error.message}`));
            }
            if (message.setupComplete && !setupComplete) {
              setupComplete = true;
              window.clearTimeout(setupTimer);
              resolve();
            }
            await handleLiveMessage(socket, message);
          } catch (reason) {
            const detail = reason instanceof Error ? reason.message : "Could not read the Gemini Live response.";
            setError(detail);
          }
        };
        socket.onerror = () => {
          const reason = new Error("Could not connect to Gemini Live. Check network and API access.");
          if (setupComplete) setError(reason.message);
          else rejectSetup(reason);
        };
        socket.onclose = (event) => {
          if (socketRef.current !== socket) return;
          if (!setupComplete) {
            rejectSetup(new Error(event.reason || "Gemini Live closed before setup completed."));
          } else if (event.code !== 1000) {
            setError(event.reason || "Gemini Live closed unexpectedly.");
          }
          cleanupVoice(false);
          setConnected(false);
          setMuted(false);
          setStatus("Gemini Live session ended.");
        };
      });

      await setupReady;
      const captureNode = new AudioWorkletNode(inputContext, "gemini-audio-capture");
      captureNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (socket.readyState !== WebSocket.OPEN) return;
        const samples = event.data;
        const pcm = new ArrayBuffer(samples.length * 2);
        const view = new DataView(pcm);
        for (let index = 0; index < samples.length; index += 1) {
          const sample = Math.max(-1, Math.min(1, samples[index]));
          view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        }
        socket.send(JSON.stringify({
          realtimeInput: {
            audio: {
              data: toBase64(pcm),
              mimeType: `audio/pcm;rate=${inputContext.sampleRate || INPUT_SAMPLE_RATE}`,
            },
          },
        }));
      };
      const source = inputContext.createMediaStreamSource(mediaStream);
      source.connect(captureNode);
      captureNode.connect(inputContext.destination);
      captureSourceRef.current = source;
      captureNodeRef.current = captureNode;
      setConnected(true);
      setStatus("Connected — speak naturally or type a message.");
    } catch (reason) {
      cleanupVoice();
      setConnected(false);
      setError(reason instanceof Error ? reason.message : "Could not start the Gemini Live session.");
      setStatus("");
    } finally {
      setConnecting(false);
    }
  };

  const stop = () => {
    cleanupVoice();
    setConnected(false);
    setMuted(false);
    setStatus("Voice session ended.");
  };

  const toggleMute = () => {
    const stream = mediaStreamRef.current;
    if (!stream) return;
    const nextMuted = !muted;
    stream.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; });
    setMuted(nextMuted);
  };

  const sendText = (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    const socket = socketRef.current;
    if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ realtimeInput: { text } }));
    const userMessage: Message = { role: "user", content: text };
    setMessages((current) => [...current, userMessage].slice(-12));
    setDraft("");
    setError("");
    setStatus("Gemini is responding…");
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
              I agree to send my live voice or typed messages and a brief energy summary (usage estimate, peak, weather and advice) to Google to operate this session. My name, exact address, precise location and raw usage history are not included. Gemini Live usage may incur charges.
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
            {messages.length === 0 && !partialUser && !partialAssistant && <p className="text-sm text-ink-3">Listening — ask about your energy peak, usage, weather, or what you can do to prepare.</p>}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === "user" ? "bg-ink text-bg" : "border border-line bg-card text-ink"
                }`}>{message.content}</p>
              </div>
            ))}
            {partialUser && <p className="justify-self-end rounded-2xl bg-ink/70 px-3 py-2 text-sm text-bg">{partialUser}</p>}
            {partialAssistant && <p className="max-w-[88%] rounded-2xl border border-line bg-card px-3 py-2 text-sm text-ink">{partialAssistant}</p>}
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
