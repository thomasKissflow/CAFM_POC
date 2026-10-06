// Voice session state machine: listen → think → speak, with barge-in (caller talks over the agent,
// the agent stops mid-sentence and listens) and end-of-turn detection. Brain and speech are injected.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/domain/types";
import { toGst } from "@/domain/time";
import { langOf } from "./nlu";
import { isEcho, Listener, MicMeter, Speaker } from "./speech";
import type { VoiceBrain, VoiceContext, VoiceLine, VoiceSlots, VoiceStage } from "./types";

export type VoiceStatus = "idle" | "listening" | "hearing" | "thinking" | "speaking" | "submitting" | "done" | "error";

export interface SessionLine extends VoiceLine {
  id: string;
  at: string;
}

/** Scripted caller for demos and tests: each line is "spoken" after the agent finishes, or cuts in. */
export interface SimLine {
  text: string;
  /** Barge in this many ms after the agent starts speaking (instead of waiting for it to finish). */
  interruptAfterMs?: number;
}

export interface VoiceSessionOptions {
  brain: VoiceBrain;
  context: VoiceContext;
  soundOn: boolean;
  now: () => number;
  onSubmit: (slots: VoiceSlots, lines: SessionLine[], lang: Lang) => Promise<string>;
}

const END_OF_TURN_MS = 750;
let lineSeq = 0;

export function useVoiceSession(opts: VoiceSessionOptions) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [lines, setLines] = useState<SessionLine[]>([]);
  const [interim, setInterim] = useState("");
  const [slots, setSlots] = useState<VoiceSlots>({});
  const [stage, setStage] = useState<VoiceStage>("gathering");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [interruptions, setInterruptions] = useState(0);

  // mutable mirrors for event callbacks
  const r = useRef({
    status: "idle" as VoiceStatus,
    lines: [] as SessionLine[],
    slots: {} as VoiceSlots,
    lang: opts.context.lang as Lang,
    pending: "",
    commitTimer: 0,
    abort: null as AbortController | null,
    turnDone: true,
    afterSpeech: null as null | (() => void),
    sim: null as SimLine[] | null,
    simTimer: 0,
    muted: false
  });
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const set = (s: VoiceStatus) => {
    r.current.status = s;
    setStatus(s);
  };
  const pushLine = (role: VoiceLine["role"], text: string): SessionLine => {
    const line: SessionLine = { id: `L${++lineSeq}`, role, text, at: toGst(optsRef.current.now()) };
    r.current.lines = [...r.current.lines, line];
    setLines(r.current.lines);
    return line;
  };
  const patchLine = (id: string, patch: Partial<SessionLine>) => {
    r.current.lines = r.current.lines.map((l) => (l.id === id ? { ...l, ...patch } : l));
    setLines(r.current.lines);
  };

  const speakerRef = useRef<Speaker | null>(null);
  const listenerRef = useRef<Listener | null>(null);
  const meterRef = useRef<MicMeter | null>(null);

  const scheduleSim = useCallback(() => {
    const sim = r.current.sim;
    if (!sim || sim.length === 0 || r.current.status === "done") return;
    const next = sim[0];
    if (next.interruptAfterMs !== undefined) return; // fired from the speaking phase instead
    window.clearTimeout(r.current.simTimer);
    r.current.simTimer = window.setTimeout(() => {
      sim.shift();
      simulateUtterance(next.text);
    }, 650);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAgentIdle = useCallback(() => {
    if (r.current.status !== "speaking" || !r.current.turnDone) return;
    const after = r.current.afterSpeech;
    r.current.afterSpeech = null;
    if (after) return after();
    set("listening");
    scheduleSim();
  }, [scheduleSim]);

  if (speakerRef.current === null) {
    speakerRef.current = new Speaker({
      onStart: () => {
        if (r.current.status === "thinking") set("speaking");
      },
      onIdle: () => onAgentIdle(),
      onProgress: () => {}
    });
  }

  /** Agent turn: stream the brain's reply into captions + speech, sentence by sentence. */
  const runTurn = useCallback(async () => {
    const speaker = speakerRef.current!;
    speaker.resetTurn();
    speaker.enabled = optsRef.current.soundOn;
    const ctrl = new AbortController();
    r.current.abort = ctrl;
    r.current.turnDone = false;
    set("thinking");
    const line = pushLine("agent", "");
    let text = "";
    let flushed = 0;
    const lang = r.current.lang;
    /** Hand complete sentences to the speaker as soon as they stream in (lower perceived latency). */
    const flush = (final: boolean) => {
      const rest = text.slice(flushed);
      let cut = final ? rest.length : -1;
      if (!final) {
        const re = /[.!?؟](\s|$)/g;
        let mm: RegExpExecArray | null;
        while ((mm = re.exec(rest))) cut = mm.index + 1;
      }
      if (cut > 0) {
        speaker.enqueue(rest.slice(0, cut), lang);
        flushed += cut;
      }
    };
    // arm a scripted barge-in, if the next simulated caller line interrupts
    const sim = r.current.sim;
    if (sim && sim[0]?.interruptAfterMs !== undefined) {
      const cut = sim.shift()!;
      window.clearTimeout(r.current.simTimer);
      r.current.simTimer = window.setTimeout(() => simulateUtterance(cut.text, true), cut.interruptAfterMs);
    }
    try {
      const res = await optsRef.current.brain.respond(
        { history: r.current.lines.filter((l) => l.id !== line.id).map(({ role, text: t, interrupted }) => ({ role, text: t, interrupted })), slots: r.current.slots, context: optsRef.current.context, lang },
        (delta) => {
          text += delta;
          patchLine(line.id, { text });
          flush(false);
        },
        ctrl.signal
      );
      if (ctrl.signal.aborted) return;
      text = text || res.say;
      patchLine(line.id, { text });
      flush(true);
      r.current.slots = res.slots;
      r.current.lang = res.lang;
      setSlots(res.slots);
      setStage(res.stage);
      r.current.turnDone = true;
      if (res.stage === "submit") {
        r.current.afterSpeech = () => void submit();
      }
      if (!speaker.isSpeaking) {
        // nothing (left) to speak: move on as if speech just finished
        set("speaking");
        onAgentIdle();
      }
    } catch (e) {
      if (ctrl.signal.aborted || (e as Error).name === "AbortError") return;
      r.current.turnDone = true;
      setError((e as Error).message);
      patchLine(line.id, { text: lang === "ar" ? "عذرًا، حدث خطأ. هل يمكنك الإعادة؟" : "Sorry, something went wrong on my side. Could you say that again?" });
      set("listening");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAgentIdle]);

  const submit = useCallback(async () => {
    set("submitting");
    try {
      const say = await optsRef.current.onSubmit(r.current.slots, r.current.lines, r.current.lang);
      pushLine("agent", say);
      r.current.turnDone = true;
      r.current.afterSpeech = () => {
        set("done");
        listenerRef.current?.stop();
      };
      speakerRef.current!.resetTurn();
      set("speaking");
      speakerRef.current!.enqueue(say, r.current.lang);
    } catch (e) {
      setError((e as Error).message);
      set("error");
    }
  }, []);

  /** Caller barged in: stop speaking and generating immediately, keep what was actually said. */
  const interrupt = useCallback(() => {
    const st = r.current.status;
    if (st !== "speaking" && st !== "thinking") return;
    r.current.abort?.abort();
    const spoken = speakerRef.current!.cancel();
    const last = [...r.current.lines].reverse().find((l) => l.role === "agent");
    if (last) {
      const cut = last.text.length > 0 && spoken > 0 && spoken < last.text.length ? `${last.text.slice(0, spoken).trimEnd()}…` : last.text;
      patchLine(last.id, { text: cut || "…", interrupted: true });
    }
    r.current.afterSpeech = null;
    r.current.turnDone = true;
    setInterruptions((n) => n + 1);
    set("hearing");
  }, []);

  const commitCaller = useCallback(() => {
    const text = r.current.pending.trim();
    r.current.pending = "";
    setInterim("");
    if (!text) return;
    r.current.lang = langOf(text, r.current.lang);
    pushLine("caller", text);
    void runTurn();
  }, [runTurn]);

  const onInterim = useCallback((t: string, forced = false) => {
    if (r.current.muted || r.current.status === "done" || r.current.status === "submitting") return;
    const st = r.current.status;
    if (st === "speaking" || st === "thinking") {
      const agentNow = speakerRef.current!.currentSentence || [...r.current.lines].reverse().find((l) => l.role === "agent")?.text || "";
      const words = t.trim().split(/\s+/).filter(Boolean).length;
      if (!forced && (words < 2 || isEcho(t, agentNow))) return; // likely our own voice / a cough
      interrupt();
    }
    if (r.current.status === "listening") set("hearing");
    setInterim(`${r.current.pending} ${t}`.trim());
    window.clearTimeout(r.current.commitTimer);
    r.current.commitTimer = window.setTimeout(commitCaller, END_OF_TURN_MS * 1.6);
  }, [commitCaller, interrupt]);

  const onFinal = useCallback((t: string) => {
    if (r.current.muted || r.current.status === "done" || r.current.status === "submitting") return;
    if ((r.current.status === "speaking" || r.current.status === "thinking") && isEcho(t, speakerRef.current!.currentSentence)) return;
    if (r.current.status === "speaking" || r.current.status === "thinking") interrupt();
    r.current.pending = `${r.current.pending} ${t}`.trim();
    setInterim(r.current.pending);
    if (r.current.status === "listening") set("hearing");
    window.clearTimeout(r.current.commitTimer);
    r.current.commitTimer = window.setTimeout(commitCaller, END_OF_TURN_MS);
  }, [commitCaller, interrupt]);

  /** Scripted caller: reveals the utterance word by word like live recognition, then ends the turn. */
  const simulateUtterance = useCallback((text: string, barge = false) => {
    const words = text.split(/\s+/);
    let i = 0;
    const step = () => {
      i += 1;
      const partial = words.slice(0, i).join(" ");
      if (i === 1 && barge) onInterim(partial, true);
      else if (i < words.length) {
        if (r.current.status === "listening") set("hearing");
        setInterim(partial);
      }
      if (i < words.length) {
        r.current.simTimer = window.setTimeout(step, 150);
      } else {
        onFinal(text);
      }
    };
    step();
  }, [onFinal, onInterim]);

  const start = useCallback(async (simulate?: SimLine[]) => {
    const o = optsRef.current;
    setError(null);
    r.current.lines = [];
    setLines([]);
    r.current.slots = {};
    setSlots({});
    setStage("gathering");
    setInterruptions(0);
    r.current.lang = o.context.lang;
    r.current.sim = simulate ? [...simulate] : null;
    speakerRef.current!.unlock();
    speakerRef.current!.enabled = o.soundOn;
    if (!simulate) {
      meterRef.current = new MicMeter();
      await meterRef.current.start(setLevel);
      listenerRef.current = new Listener({ onInterim: (t) => onInterim(t), onFinal, onError: (m) => { setError(m); } });
      listenerRef.current.start(o.context.lang);
    }
    // greeting
    const greet = o.brain.greet(o.context);
    pushLine("agent", greet);
    r.current.turnDone = true;
    speakerRef.current!.resetTurn();
    set("speaking");
    speakerRef.current!.enqueue(greet, o.context.lang);
  }, [onFinal, onInterim]);

  const stop = useCallback(() => {
    window.clearTimeout(r.current.commitTimer);
    window.clearTimeout(r.current.simTimer);
    r.current.abort?.abort();
    speakerRef.current?.cancel();
    listenerRef.current?.stop();
    meterRef.current?.stop();
    r.current.sim = null;
    setLevel(0);
    set("idle");
  }, []);

  /** Typed fallback (no mic, or the caller prefers typing). */
  const sendText = useCallback((text: string) => {
    if (!text.trim()) return;
    if (r.current.status === "speaking" || r.current.status === "thinking") interrupt();
    r.current.pending = text;
    commitCaller();
  }, [commitCaller, interrupt]);

  const toggleMute = useCallback(() => {
    r.current.muted = !r.current.muted;
    setMuted(r.current.muted);
  }, []);

  useEffect(() => () => stop(), [stop]);
  useEffect(() => {
    if (speakerRef.current) speakerRef.current.enabled = opts.soundOn;
  }, [opts.soundOn]);

  return { status, lines, interim, slots, stage, level, error, muted, interruptions, start, stop, sendText, toggleMute, interrupt };
}
