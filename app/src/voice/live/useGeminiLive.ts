// Gemini Live voice session: the browser streams mic audio straight to Gemini with a single-use token from our
// backend, plays the spoken reply, and follows the call through transcription and the record_request tool.
// Same return shape as useVoiceSession, so the voice screen can switch engines.
//
// Verified against the live API on 22 Sep: output audio is 24 kHz PCM; the token locks the model, prompt, voice,
// transcription and compression; the browser declares the tool and passes the resume handle (see server/ai/voice.ts).
import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import type { Category, Lang } from "@/domain/types";
import { toGst } from "@/domain/time";
import { CATEGORIES as TOOL_CATEGORIES, RECORD_REQUEST } from "../../../shared/voice-tool";
import type { SessionLine, VoiceStatus } from "../useVoiceSession";
import type { VoiceContext, VoiceSlots, VoiceStage } from "../types";
import { AiApiError } from "./aiApi";
import type { LiveTokenRequest, LiveTokenResponse } from "../../../shared/ai-types";
import { MicCapture, PcmPlayer, toBase64 } from "./audio";

export type LiveConn = "off" | "connecting" | "connected" | "reconnecting" | "closed";

/** Everything the screen needs to save the call when it ends. */
export interface LiveCallRecord {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  lang: Lang;
  model: string;
  lines: SessionLine[];
  slots: VoiceSlots;
  submitted?: { workOrderId: string; ref: string };
  usage: { input?: number; output?: number; total?: number };
}

export interface GeminiLiveOptions {
  /** Where the single-use token comes from: our backend, or (POC, inside Kissflow) minted here from the stored key. */
  liveToken: (req: LiveTokenRequest) => Promise<LiveTokenResponse>;
  context: VoiceContext;
  soundOn: boolean;
  userId: string;
  now: () => number;
  /** Logs the work order; returns what the agent should read back (with the real reference and times). */
  onSubmit: (slots: VoiceSlots, lines: SessionLine[], lang: Lang) => Promise<{ say: string; workOrderId: string; ref: string }>;
  /** Called once when the call ends (hang-up, completion or failure) if anything was said. */
  onEnd?: (rec: LiveCallRecord) => void;
}

const MAX_RECONNECTS = 3;
let seq = 0;

function errorText(e: unknown, lang: Lang): string {
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError")) return L("Microphone access is blocked, so type instead. To talk, allow the microphone for this site and start again.", "الميكروفون محظور، يمكنك الكتابة بدلًا من ذلك. للتحدث اسمحي بالميكروفون وابدئي من جديد.");
  if (e instanceof DOMException && e.name === "NotFoundError") return L("No microphone was found, so type instead.", "لم يتم العثور على ميكروفون في هذا الجهاز.");
  if (e instanceof AiApiError) {
    if (e.code === "rate_limited") return L("Too many voice calls this hour. Please try again later.", "عدد كبير من المكالمات هذه الساعة. حاولي لاحقًا.");
    if (e.code === "network") return L("The voice service can't be reached. Check the connection or switch to the demo voice.", "لا يمكن الوصول إلى خدمة الصوت. تحققي من الاتصال أو استخدمي الصوت التجريبي.");
    if (e.code === "misconfigured") return L("The voice service isn't set up on the server (Gemini key missing).", "خدمة الصوت غير مهيأة على الخادم.");
    return e.message;
  }
  const m = e instanceof Error ? e.message : String(e);
  if (/expired|1008|unauth|permission/i.test(m)) return L("The voice session expired. Start the call again.", "انتهت صلاحية جلسة الصوت. ابدئي المكالمة مجددًا.");
  return m;
}

const CATEGORIES = new Set<string>(TOOL_CATEGORIES);
/** Transcription can carry control markers such as "<no speech>" or "{pause}"; they are not words. */
const clean = (t: string) => t.replace(/<[^>]{1,40}>|\{[^}]{1,40}\}/g, "");

/** Tool arguments → the job card's slots (only fields the agent actually sent). */
function mergeSlots(prev: VoiceSlots, a: Record<string, unknown>): VoiceSlots {
  const next: VoiceSlots = { ...prev };
  if (typeof a.category === "string" && CATEGORIES.has(a.category)) next.category = a.category as Category;
  if (typeof a.symptom === "string" && a.symptom !== "") next.symptom = a.symptom;
  if (typeof a.room === "string" && a.room !== "") next.room = a.room;
  if (typeof a.since === "string" && a.since !== "") next.since = a.since;
  if (typeof a.vulnerable_occupant === "boolean") next.vulnerableOccupant = a.vulnerable_occupant;
  if (typeof a.safety_hazard === "boolean") next.safetyHazard = a.safety_hazard;
  if (typeof a.access === "string" && a.access !== "") next.access = a.access;
  if (typeof a.summary === "string" && a.summary !== "") next.summary = a.summary;
  return next;
}

export function useGeminiLive(opts: GeminiLiveOptions) {
  const [status, setStatusState] = useState<VoiceStatus>("idle");
  const [conn, setConn] = useState<LiveConn>("off");
  const [lines, setLines] = useState<SessionLine[]>([]);
  const [interim, setInterim] = useState("");
  const [slots, setSlots] = useState<VoiceSlots>({});
  const [stage, setStage] = useState<VoiceStage>("gathering");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [interruptions, setInterruptions] = useState(0);
  const [model, setModel] = useState<string | undefined>(undefined);
  const [textOnly, setTextOnly] = useState(false);

  const optsRef = useRef(opts);
  optsRef.current = opts;
  const r = useRef({
    status: "idle" as VoiceStatus,
    session: null as Session | null,
    lines: [] as SessionLine[],
    openCaller: null as string | null,
    openAgent: null as string | null,
    slots: {} as VoiceSlots,
    lang: opts.context.lang as Lang,
    handle: undefined as string | undefined,
    reconnects: 0,
    userStopped: false,
    swapping: false,
    ended: false,
    muted: false,
    finishAfterTurn: false,
    awaitReadback: false,
    submitted: undefined as LiveCallRecord["submitted"],
    startedAt: "",
    sessionId: "",
    model: "",
    usage: {} as LiveCallRecord["usage"],
    hearTimer: 0
  });
  const micRef = useRef<MicCapture | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);

  const setStatus = (s: VoiceStatus) => { r.current.status = s; setStatusState(s); };
  const now = () => toGst(optsRef.current.now());
  const publish = () => setLines([...r.current.lines]);
  const push = (role: SessionLine["role"], text: string): string => {
    const id = `G${++seq}`;
    r.current.lines = [...r.current.lines, { id, role, text, at: now() }];
    publish();
    return id;
  };
  const raw = useRef(new Map<string, string>());
  const append = (id: string, delta: string) => {
    const full = (raw.current.get(id) ?? "") + delta;
    raw.current.set(id, full);
    r.current.lines = r.current.lines.map((l) => (l.id === id ? { ...l, text: clean(full).replace(/\s{2,}/g, " ").trimStart() } : l));
    publish();
  };
  const markInterrupted = (id: string) => {
    r.current.lines = r.current.lines.map((l) => (l.id === id ? { ...l, interrupted: true, text: l.text.trimEnd() + (l.text.endsWith("…") ? "" : "…") } : l));
    publish();
  };

  const teardown = useCallback(() => {
    window.clearTimeout(r.current.hearTimer);
    if (micRef.current !== null) { micRef.current.stop(); micRef.current = null; }
    if (playerRef.current !== null) playerRef.current.flush();
    const s = r.current.session;
    r.current.session = null;
    if (s !== null) { r.current.swapping = true; try { s.close(); } catch { /* already closed */ } r.current.swapping = false; }
    setLevel(0);
  }, []);

  /** End of call: save once, whatever the reason. */
  const finish = useCallback((final: VoiceStatus) => {
    if (r.current.ended) return;
    r.current.ended = true;
    teardown();
    setConn("closed");
    setStatus(final);
    const spoken = r.current.lines.filter((l) => l.text.trim() !== "");
    if (spoken.length > 0 && optsRef.current.onEnd !== undefined) {
      optsRef.current.onEnd({
        sessionId: r.current.sessionId, startedAt: r.current.startedAt, endedAt: new Date(optsRef.current.now()).toISOString(), lang: r.current.lang,
        model: r.current.model, lines: spoken, slots: r.current.slots, submitted: r.current.submitted, usage: { ...r.current.usage }
      });
    }
  }, [teardown]);

  const onPlaybackIdle = useCallback(() => {
    if (r.current.status === "speaking") setStatus("listening");
    if (r.current.finishAfterTurn && r.current.openAgent === null) finish("done");
  }, [finish]);

  const handleTool = useCallback(async (session: Session, calls: NonNullable<LiveServerMessage["toolCall"]>["functionCalls"]) => {
    const responses = [];
    for (const fc of calls ?? []) {
      if (fc.name !== "record_request") { responses.push({ id: fc.id, name: fc.name, response: { error: "unknown tool" } }); continue; }
      const args = (fc.args ?? {}) as Record<string, unknown>;
      if (args.language === "ar" || args.language === "en") r.current.lang = args.language;
      r.current.slots = mergeSlots(r.current.slots, args);
      setSlots(r.current.slots);
      if (args.confirmed === true && r.current.submitted === undefined) {
        setStage("submit");
        setStatus("submitting");
        try {
          const res = await optsRef.current.onSubmit(r.current.slots, r.current.lines, r.current.lang);
          r.current.submitted = { workOrderId: res.workOrderId, ref: res.ref };
          r.current.awaitReadback = true; // finish after the agent has read the reference out, not on this tool turn
          responses.push({ id: fc.id, name: fc.name, response: { logged: true, reference: res.ref, say: res.say } });
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          responses.push({ id: fc.id, name: fc.name, response: { error: "The request could not be logged. The team will call the resident back." } });
        }
        setStatus("thinking");
      } else {
        if (args.confirmed !== true && r.current.slots.category !== undefined && r.current.slots.room !== undefined && r.current.slots.access !== undefined) setStage("confirming");
        responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
      }
    }
    if (r.current.session === session) session.sendToolResponse({ functionResponses: responses });
  }, []);

  const onMessage = useCallback((session: Session, m: LiveServerMessage) => {
    if (m.sessionResumptionUpdate !== undefined && m.sessionResumptionUpdate.resumable === true && typeof m.sessionResumptionUpdate.newHandle === "string") r.current.handle = m.sessionResumptionUpdate.newHandle;
    if (m.usageMetadata !== undefined) {
      // ASSUMPTION: counts are cumulative for the session, so the latest value is the call total.
      const u = m.usageMetadata;
      r.current.usage = { input: u.promptTokenCount ?? r.current.usage.input, output: u.responseTokenCount ?? r.current.usage.output, total: u.totalTokenCount ?? r.current.usage.total };
    }
    if (m.goAway !== undefined) { void reconnect("goaway"); return; }
    if (m.toolCall !== undefined) void handleTool(session, m.toolCall.functionCalls);
    const sc = m.serverContent;
    if (sc === undefined) return;
    const player = playerRef.current;
    if (sc.interrupted === true) {
      if (player !== null) player.flush();
      if (r.current.openAgent !== null) { markInterrupted(r.current.openAgent); r.current.openAgent = null; }
      setInterruptions((n) => n + 1);
      setStatus("hearing");
    }
    const heard = sc.inputTranscription !== undefined && typeof sc.inputTranscription.text === "string" ? sc.inputTranscription.text : "";
    const said = sc.outputTranscription !== undefined && typeof sc.outputTranscription.text === "string" ? sc.outputTranscription.text : "";
    if (heard !== "") {
      const t = heard;
      if (r.current.openAgent !== null) r.current.openAgent = null;
      if (r.current.openCaller === null) r.current.openCaller = push("caller", "");
      append(r.current.openCaller, t);
      const cur = r.current.lines.find((l) => l.id === r.current.openCaller);
      setInterim(cur !== undefined ? cur.text : "");
      if (/[؀-ۿ]/.test(t)) r.current.lang = "ar";
      if (r.current.status !== "submitting") setStatus("hearing");
      window.clearTimeout(r.current.hearTimer);
      r.current.hearTimer = window.setTimeout(() => { if (r.current.status === "hearing") setStatus("thinking"); }, 900);
    }
    if (said !== "") {
      const t = said;
      r.current.openCaller = null;
      setInterim("");
      if (r.current.openAgent === null) r.current.openAgent = push("agent", "");
      append(r.current.openAgent, t);
    }
    const readbackStarted = clean(said).trim() !== ""
      || (sc.modelTurn !== undefined && sc.modelTurn.parts !== undefined && sc.modelTurn.parts.some((p) => p.inlineData !== undefined));
    if (r.current.awaitReadback && readbackStarted) { r.current.awaitReadback = false; r.current.finishAfterTurn = true; }
    const parts = sc.modelTurn !== undefined && sc.modelTurn.parts !== undefined ? sc.modelTurn.parts : [];
    for (const p of parts) {
      if (p.inlineData !== undefined && typeof p.inlineData.data === "string" && player !== null) {
        player.enqueueBase64(p.inlineData.data);
        if (r.current.status !== "speaking") setStatus("speaking");
      }
    }
    if (sc.turnComplete === true) {
      r.current.openAgent = null;
      if (player === null || !player.playing) {
        if (r.current.finishAfterTurn) finish("done");
        else if (r.current.status !== "hearing") setStatus("listening");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleTool, finish]);

  /** Opens a Live session with a fresh single-use token (resuming by handle when we have one). */
  const open = useCallback(async (resume: boolean) => {
    const o = optsRef.current;
    const token = await o.liveToken({
      userId: o.userId, lang: o.context.lang,
      caller: { residentName: o.context.residentName, unitLabel: o.context.unitLabel, siteName: o.context.siteName, inDlp: o.context.inDlp }
    });
    r.current.model = token.model;
    setModel(token.model);
    const ai = new GoogleGenAI({ apiKey: token.token, httpOptions: { apiVersion: token.apiVersion } });
    let opened: Session | null = null;
    const session = await ai.live.connect({
      model: token.model,
      config: {
        responseModalities: [Modality.AUDIO],
        tools: [{ functionDeclarations: [RECORD_REQUEST] }],
        sessionResumption: resume && r.current.handle !== undefined ? { handle: r.current.handle } : {}
      },
      callbacks: {
        onmessage: (m) => { if (opened !== null && r.current.session === opened) onMessage(opened, m); },
        onerror: (e) => { if (opened !== null && r.current.session === opened) setError(errorText(new Error((e as ErrorEvent).message ?? "connection error"), r.current.lang)); },
        onclose: (e) => {
          if (opened === null || r.current.session !== opened || r.current.swapping || r.current.userStopped || r.current.ended) return;
          // unexpected drop (network, server limit): try to resume the same conversation
          if (r.current.handle !== undefined && r.current.reconnects < MAX_RECONNECTS) void reconnect("drop");
          else { setError(errorText(new Error(`${e.code} ${e.reason}`), r.current.lang)); finish("error"); }
        }
      }
    });
    opened = session;
    r.current.session = session;
    setConn("connected");
    return session;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMessage, finish]);

  const reconnect = useCallback(async (why: "goaway" | "drop") => {
    if (r.current.ended || r.current.userStopped || r.current.status === "idle") return;
    r.current.reconnects += 1;
    setConn("reconnecting");
    const old = r.current.session;
    r.current.session = null;
    if (old !== null && why === "goaway") { r.current.swapping = true; try { old.close(); } catch { /* ignore */ } r.current.swapping = false; }
    try {
      await open(true);
    } catch (e) {
      setError(errorText(e, r.current.lang));
      finish("error");
    }
  }, [open, finish]);

  const start = useCallback(async () => {
    const o = optsRef.current;
    raw.current.clear();
    Object.assign(r.current, {
      lines: [], openCaller: null, openAgent: null, slots: {}, lang: o.context.lang, handle: undefined, reconnects: 0, userStopped: false,
      ended: false, finishAfterTurn: false, awaitReadback: false, submitted: undefined, startedAt: new Date(o.now()).toISOString(), sessionId: `live-${Date.now().toString(36)}`, usage: {}
    });
    setLines([]); setSlots({}); setStage("gathering"); setInterim(""); setError(null); setInterruptions(0); setTextOnly(false);
    if (playerRef.current === null) playerRef.current = new PcmPlayer(() => onPlaybackIdle());
    playerRef.current.unlock();
    playerRef.current.setMuted(!o.soundOn);
    setStatus("thinking");
    setConn("connecting");
    try {
      const mic = new MicCapture();
      micRef.current = mic;
      try {
        await mic.start((pcm) => {
          const s = r.current.session;
          if (s === null || r.current.muted || r.current.ended) return;
          s.sendRealtimeInput({ audio: { data: toBase64(pcm), mimeType: "audio/pcm;rate=16000" } });
        }, setLevel);
      } catch (e) {
        // no microphone: keep the call going by typing (the agent still speaks)
        mic.stop();
        micRef.current = null;
        setError(errorText(e, o.context.lang));
        setTextOnly(true);
      }
      const session = await open(false);
      // the agent speaks first
      session.sendRealtimeInput({ text: o.context.lang === "ar" ? "(بدأت المكالمة الآن. رحّبي بالمتصل باختصار واسألي عن المشكلة.)" : "(The call has just connected. Greet the caller briefly and ask what the problem is.)" });
    } catch (e) {
      setError(errorText(e, o.context.lang));
      r.current.ended = true;
      teardown();
      setConn("closed");
      setStatus("error");
    }
  }, [open, onPlaybackIdle, teardown]);

  const stop = useCallback(() => {
    r.current.userStopped = true;
    if (r.current.status === "idle") return;
    if (!r.current.ended) finish(r.current.submitted !== undefined ? "done" : "idle");
    setStatus("idle");
    setConn("off");
  }, [finish]);

  const sendText = useCallback((text: string) => {
    const s = r.current.session;
    if (s === null || text.trim() === "") return;
    if (playerRef.current !== null) playerRef.current.flush();
    r.current.openAgent = null;
    r.current.openCaller = null;
    push("caller", text.trim());
    r.current.openCaller = null;
    s.sendRealtimeInput({ text: text.trim() });
    setStatus("thinking");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = useCallback(() => { r.current.muted = !r.current.muted; setMuted(r.current.muted); }, []);
  const interrupt = useCallback(() => { if (playerRef.current !== null) playerRef.current.flush(); }, []);

  useEffect(() => { if (playerRef.current !== null) playerRef.current.setMuted(!opts.soundOn); }, [opts.soundOn]);
  useEffect(() => () => {
    r.current.userStopped = true;
    teardown();
    if (playerRef.current !== null) { playerRef.current.close(); playerRef.current = null; }
  }, [teardown]);

  return { status, conn, model, textOnly, lines, interim, slots, stage, level, error, muted, interruptions, start, stop, sendText, toggleMute, interrupt };
}
