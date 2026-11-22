import { AudioLines, Mic, MicOff, Send, Square, Volume2 } from "lucide-react";
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
  app_state?: Record<string, unknown>;
  devices?: Record<string, unknown>[];
  open_alerts?: Record<string, unknown>[];
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
const AGENT_INSTRUCTIONS = `You are WATT'FLOW, the voice assistant built into the Mieruka energy app (KIZUNA 2026). You are NOT a general chatbot: you only help with THIS user's household, devices, bill, alerts and rewards inside this app. If asked about unrelated topics, politely say you only help with their energy in Mieruka and steer back.
Automatically detect the language the user is speaking and reply in that same language. Support English, Japanese, and Arabic. For Arabic, understand Tunisian Derja and reply in natural Tunisian Arabic; use Modern Standard Arabic only if the user asks for it. Never force the conversation into English or translate unless asked.
Speak naturally and briefly, usually one to three sentences. Always refer to the user's real devices by their exact names and rooms (for example "your Living-room air conditioner"), with their real numbers (watts now, kWh today, kWh this month). Never give generic energy tips when a specific device of theirs applies: rank by their actual consumption.

WHAT THE APP CONTAINS (guide the user to these screens by name):
- Home: live power, today's energy and cost, the estimated STEG bill, the monthly goal, a score.
- Devices: every appliance with its adapter (NABD QR adapters), live watts, anomalies, add/pair a device by scanning its QR.
- AI Analysis (the page you are on): forecast, 3-day weather-aware mission and peak window, alerts with evidence, recommendations that can be applied after confirmation.
- Rewards: Energy Tokens (virtual rewards, never electricity credits), challenges, solidarity projects. The app rewards savings and never punishes or cuts power.
- Explore: history, energy flows (Sankey), learning, and the Tunisia-Japan comparison.

DATA RULES: You receive a SNAPSHOT of the user's real app data at the start of the session. Call get_energy_context to refresh it whenever the user asks about current usage, a device, an alert, the bill, the forecast, risk, peak, weather, tokens or recommendations, and always before quoting live numbers. Treat that data as the ONLY source of household facts. If a device, number or feature is not in the data, say you cannot see it; never invent devices, usage, weather, prices, confidence or savings. Clearly distinguish measured readings from simulated data and from forecasts or estimates (the data labels each device as measured or simulated). Mention open alerts and the device they concern when relevant, and the suggested action.
SAFETY: Give practical, affordable advice that preserves health and comfort. Never recommend turning off refrigerators, medical devices, safety equipment, or essential systems. You have no device-control tools: never claim an action was executed; explain which button or screen in the app to use (alerts and recommendations are applied by the user after confirmation). If information is missing, say so plainly.`;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function microphoneError(reason: unknown): string {
  if (reason instanceof DOMException) {
    if (reason.name === "NotAllowedError" || reason.name === "PermissionDeniedError") {
      return "Microphone access denied. Allow the microphone in your browser settings, then try again.";
    }
    if (reason.name === "NotFoundError" || reason.name === "DevicesNotFoundError") {
      return "No microphone was found on this computer.";
    }
    if (reason.name === "NotReadableError" || reason.name === "TrackStartError") {
      return "The microphone is in use or unavailable. Close other applications that are using it.";
    }
  }
  return reason instanceof Error ? reason.message : "Could not enable the microphone.";
}

export function EnergyChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [consent, setConsent] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
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
  const analyserRef = useRef<AnalyserNode | null>(null);
  const playbackSourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const nextPlaybackTimeRef = useRef(0);
  const inputTranscriptRef = useRef("");
  const outputTranscriptRef = useRef("");

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, partialUser, partialAssistant, status]);

  useEffect(() => {
    if (!connected || !analyserRef.current) return;
    const analyser = analyserRef.current;
    const samples = new Float32Array(analyser.fftSize);
    let frame = 0;
    let lastUpdate = 0;
    let active = true;
    const measure = (time: number) => {
      if (!active) return;
      frame = window.requestAnimationFrame(measure);
      if (time - lastUpdate < 50) return;
      lastUpdate = time;
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const rms = Math.sqrt(sum / samples.length);
      setMicrophoneLevel(Math.min(1, rms * 8));
    };
    frame = window.requestAnimationFrame(measure);
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
    };
  }, [connected]);

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
    setAssistantSpeaking(false);
  }, []);

  const cleanupVoice = useCallback((closeSocket = true, clearTranscript = true) => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (closeSocket && socket && socket.readyState < WebSocket.CLOSING) socket.close();

    stopPlayback();
    captureSourceRef.current?.disconnect();
    captureNodeRef.current?.disconnect();
    analyserRef.current?.disconnect();
    captureSourceRef.current = null;
    captureNodeRef.current = null;
    analyserRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    for (const context of [inputContextRef.current, outputContextRef.current]) {
      if (context && context.state !== "closed") {
        void context.close().catch((reason) => console.error("Could not close audio context.", reason));
      }
    }
    inputContextRef.current = null;
    outputContextRef.current = null;
    setMicrophoneLevel(0);
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
    source.onended = () => {
      playbackSourcesRef.current.delete(source);
      if (playbackSourcesRef.current.size === 0) setAssistantSpeaking(false);
    };
    const startAt = Math.max(context.currentTime, nextPlaybackTimeRef.current);
    source.start(startAt);
    nextPlaybackTimeRef.current = startAt + buffer.duration;
    playbackSourcesRef.current.add(source);
    setAssistantSpeaking(true);
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

      let inputContext: AudioContext;
      try {
        inputContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
      } catch (reason) {
        console.warn("16 kHz AudioContext is unavailable; using the browser default.", reason);
        inputContext = new AudioContext();
      }
      const outputContext = new AudioContext();
      inputContextRef.current = inputContext;
      outputContextRef.current = outputContext;
      await Promise.all([inputContext.resume(), outputContext.resume()]);
      await inputContext.audioWorklet.addModule(captureWorkletUrl);
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (reason) {
        throw new Error(microphoneError(reason));
      }
      mediaStreamRef.current = mediaStream;

      let snapshot = "";
      try {
        snapshot = JSON.stringify(await api<VoiceContext>("ai/voice-context"));
      } catch (reason) {
        console.warn("Could not preload the app snapshot; the assistant will fetch it on demand.", reason);
      }
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
              systemInstruction: { parts: [{ text: snapshot ? `${AGENT_INSTRUCTIONS}

SNAPSHOT OF THE USER'S APP DATA AT SESSION START (JSON; call get_energy_context for fresh values):
${snapshot}` : AGENT_INSTRUCTIONS }] },
              inputAudioTranscription: { languageCodes: ["en", "ar", "ja"] },
              outputAudioTranscription: {},
              tools: [{
                functionDeclarations: [{
                  name: "get_energy_context",
                  description: "Read the signed-in user's live app data: their devices (name, room, watts now, kWh today/month, measured or simulated, anomalies), open alerts, bill estimate, Energy Tokens, forecast, weather, peak risk and recommended actions. Call it whenever a question concerns their own household or any screen of the app.",
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
      const analyser = inputContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(captureNode);
      source.connect(analyser);
      captureNode.connect(inputContext.destination);
      captureSourceRef.current = source;
      captureNodeRef.current = captureNode;
      analyserRef.current = analyser;
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
    if (nextMuted) setMicrophoneLevel(0);
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

  const activityLabel = muted
    ? "Microphone muted"
    : assistantSpeaking
      ? "WATT’FLOW is speaking"
      : status.includes("Checking") || status.includes("responding")
        ? "Checking your energy information"
        : microphoneLevel > 0.08
          ? "I can hear you"
          : "Listening — speak naturally";

  return (
    <Card>
      <CardTitle>Live voice energy agent</CardTitle>
      {!connected ? (
        <div className="grid gap-4">
          <p className="text-sm leading-relaxed text-ink-2">
            Speak naturally in English, Tunisian Arabic, or Japanese. WATT’FLOW automatically follows your language and can give safe, personalized energy advice.
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
            <p className="flex items-center gap-2 text-xs text-good" role="status">
              <span className="size-2 rounded-full bg-good animate-pulse-ring" />
              Connected
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={toggleMute}><>{muted ? <MicOff /> : <Mic />}{muted ? "Unmute" : "Mute"}</></Button>
              <Button size="sm" variant="danger" onClick={stop}><Square />End session</Button>
            </div>
          </div>
          <div className="grid justify-items-center gap-2 rounded-2xl bg-muted/60 px-4 py-5">
            <div className="relative grid size-28 place-items-center">
              <div
                className={`absolute inset-1 rounded-full bg-brand/10 transition-transform duration-100 ${assistantSpeaking ? "bg-info/15" : ""}`}
                style={{ transform: `scale(${1 + microphoneLevel * 0.42})` }}
              />
              <div
                className={`absolute inset-3 rounded-full border transition-all duration-100 ${
                  assistantSpeaking ? "border-info/45 shadow-[0_0_28px_var(--color-info)]" : "border-brand/30"
                }`}
                style={{ transform: `scale(${1 + microphoneLevel * 0.28})` }}
              />
              <div className={`relative grid size-16 place-items-center rounded-full text-white shadow-lg transition-colors ${
                assistantSpeaking ? "bg-info" : muted ? "bg-ink-3" : "bg-brand"
              }`}>
                {assistantSpeaking ? <Volume2 className="size-7" /> : <Mic className="size-7" />}
              </div>
            </div>
            <p className="text-sm font-medium text-ink" role="status">{activityLabel}</p>
            <div className="flex h-6 items-center gap-1" role="img" aria-label={`Microphone input level ${Math.round(microphoneLevel * 100)} percent`}>
              {Array.from({ length: 19 }, (_, index) => {
                const distance = Math.abs(index - 9) / 9;
                const barLevel = Math.max(0.12, microphoneLevel * (1.1 - distance * 0.55));
                return (
                  <span
                    key={index}
                    className={`w-1 rounded-full transition-[height,background-color] duration-100 ${
                      assistantSpeaking ? "bg-info" : muted ? "bg-line" : "bg-brand"
                    }`}
                    style={{ height: `${4 + barLevel * (16 - distance * 5)}px`, opacity: muted ? 0.65 : 0.35 + barLevel * 0.65 }}
                  />
                );
              })}
            </div>
            <span className="text-[11px] text-ink-3">{muted ? "Unmute to speak" : "Microphone input"}</span>
          </div>
          <div ref={listRef} aria-live="polite" aria-label="Conversation transcript" className="grid max-h-72 gap-3 overflow-y-auto rounded-xl bg-muted/60 p-3">
            {messages.length === 0 && !partialUser && !partialAssistant && (
              <div className="grid justify-items-center gap-2 py-2 text-center">
                <AudioLines className="size-5 text-ink-3" />
                <p className="text-sm text-ink-3">Your conversation transcript will appear here.</p>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] ${message.role === "user" ? "text-right" : ""}`}>
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-3">
                    {message.role === "user" ? "You" : "WATT’FLOW"}
                  </p>
                  <p className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    message.role === "user" ? "bg-ink text-bg" : "border border-line bg-card text-ink"
                  }`}>{message.content}</p>
                </div>
              </div>
            ))}
            {partialUser && (
              <div className="justify-self-end text-right">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-3">You · speaking</p>
                <p className="max-w-[88%] whitespace-pre-wrap rounded-2xl bg-ink/70 px-3 py-2 text-sm text-bg">{partialUser}</p>
              </div>
            )}
            {partialAssistant && (
              <div className="max-w-[88%]">
                <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-ink-3">
                  <Volume2 className="size-3" /> WATT’FLOW · speaking
                </p>
                <p className="whitespace-pre-wrap rounded-2xl border border-line bg-card px-3 py-2 text-sm leading-relaxed text-ink">{partialAssistant}</p>
              </div>
            )}
            {assistantSpeaking && !partialAssistant && (
              <p className="flex items-center gap-2 text-xs text-ink-3">
                <Volume2 className="size-3.5 text-info" /> WATT’FLOW is speaking; transcript loading…
              </p>
            )}
          </div>
          <form className="flex gap-2" onSubmit={sendText}>
            <Input value={draft} maxLength={500} onChange={(event) => setDraft(event.target.value)} placeholder="Or type in English, Arabic, or Japanese…" aria-label="Message to WATT'FLOW" />
            <Button type="submit" disabled={!draft.trim()} aria-label="Send message"><Send /></Button>
          </form>
        </div>
      )}
      {status && !connected && <p className="mt-2 text-xs text-ink-3" role="status">{status}</p>}
      {error && <p className="mt-2 text-xs text-bad" role="alert">{error}</p>}
    </Card>
  );
}
