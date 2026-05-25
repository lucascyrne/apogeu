import { useCallback, useEffect, useRef, useState } from "react";
import { parseNdjsonLine } from "./ndjsonReader";
import type { ControlFrameEvent, GestureStableEvent, NdjsonEvent } from "@hand-gestures/protocol";

function wsUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const port = params.get("wsPort") ?? "8765";
  const host = params.get("wsHost") ?? location.hostname;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${host}:${port}`;
}

export type LiveStreamState = {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastFrame: ControlFrameEvent | null;
  lastGesture: GestureStableEvent | null;
};

export function useLiveStream(
  onEvent: (ev: NdjsonEvent) => void,
  enabled: boolean
) {
  const [state, setState] = useState<LiveStreamState>({
    connected: false,
    connecting: false,
    error: null,
    lastFrame: null,
    lastGesture: null,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setState((s) => ({ ...s, connecting: true, error: null }));
    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setState((s) => ({ ...s, connected: true, connecting: false, error: null }));
    };

    ws.onmessage = (msg) => {
      const ev = parseNdjsonLine(String(msg.data));
      if (!ev) return;
      onEventRef.current(ev);
      if (ev.type === "control.frame") {
        setState((s) => ({ ...s, lastFrame: ev as ControlFrameEvent }));
      } else if (ev.type === "gesture.stable") {
        setState((s) => ({ ...s, lastGesture: ev as GestureStableEvent }));
      }
    };

    ws.onerror = () => {
      setState((s) => ({
        ...s,
        connecting: false,
        error: "Falha na conexão WebSocket (rode hand-gestures --musical)",
      }));
    };

    ws.onclose = () => {
      setState((s) => ({ ...s, connected: false, connecting: false }));
      wsRef.current = null;
    };
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }
    connect();
    return () => disconnect();
  }, [enabled, connect, disconnect]);

  return { ...state, connect, disconnect, wsUrl: wsUrl() };
}
