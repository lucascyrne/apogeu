import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAudioEngine, type EngineStatus } from "@hand-gestures/audio";
import type { NdjsonEvent } from "@hand-gestures/protocol";

export function useAudioEngine() {
  const engineRef = useRef(createAudioEngine());
  const [ready, setReady] = useState(false);
  const [lastNote, setLastNote] = useState("—");
  const [status, setStatus] = useState<EngineStatus>(
    engineRef.current.getStatus()
  );
  const hudPendingRef = useRef(false);

  const syncHud = useCallback(() => {
    setLastNote(engineRef.current.getLastNote());
    setStatus({ ...engineRef.current.getStatus() });
    hudPendingRef.current = false;
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (hudPendingRef.current) syncHud();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [syncHud]);

  const scheduleHud = useCallback(() => {
    hudPendingRef.current = true;
  }, []);

  const start = useCallback(async () => {
    await engineRef.current.start();
    setReady(true);
    syncHud();
  }, [syncHud]);

  const handleLine = useCallback(
    (line: string) => {
      engineRef.current.handleLine(line);
      scheduleHud();
    },
    [scheduleHud]
  );

  const handleEvent = useCallback(
    (ev: NdjsonEvent) => {
      handleLine(JSON.stringify(ev));
    },
    [handleLine]
  );

  const api = useMemo(
    () => ({
      ready,
      start,
      lastNote,
      status,
      handleLine,
      handleEvent,
    }),
    [ready, start, lastNote, status, handleLine, handleEvent]
  );

  return api;
}
