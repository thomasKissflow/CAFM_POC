import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useServices } from "@/services/context";
import { useSession } from "@/app/session";
import { BEATS, type Beat } from "./script";

interface DemoState {
  active: boolean;
  index: number;
  beat: Beat;
  start: () => void;
  exit: () => void;
  goTo: (i: number) => void;
  runAction: () => Promise<void>;
  running: boolean;
}

const Ctx = createContext<DemoState | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const services = useServices();
  const { setRole } = useSession();
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);

  const visit = useCallback((i: number) => {
    const beat = BEATS[i];
    setRole(beat.role);
    const storyId = services.demo.storyWorkOrderId();
    navigate(typeof beat.route === "function" ? beat.route(storyId) : beat.route);
  }, [navigate, services, setRole]);

  const goTo = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(BEATS.length - 1, i));
    setIndex(clamped);
    visit(clamped);
  }, [visit]);

  const runAction = useCallback(async () => {
    const beat = BEATS[index];
    if (beat.action === undefined) return;
    setRunning(true);
    try {
      if (beat.action === "close") {
        await services.demo.runStoryStep("raise");
        await services.demo.runStoryStep("accept");
        await services.demo.runStoryStep("resolve_dlp");
        await services.demo.runStoryStep("close");
      } else if (beat.action === "accept") {
        await services.demo.runStoryStep("raise");
        await services.demo.runStoryStep("accept");
      } else {
        await services.demo.runStoryStep(beat.action);
      }
      visit(index);
    } finally {
      setRunning(false);
    }
  }, [index, services, visit]);

  const value = useMemo<DemoState>(() => ({
    active, index, beat: BEATS[index], running,
    start: () => {
      setActive(true);
      goTo(0);
    },
    exit: () => setActive(false),
    goTo, runAction
  }), [active, index, running, goTo, runAction]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo(): DemoState {
  const d = useContext(Ctx);
  if (d === null) throw new Error("useDemo outside DemoProvider");
  return d;
}
