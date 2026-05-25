import { useCallback, useEffect, useRef, useState } from "react";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null!);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");

  const refreshDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    setDevices(all.filter((d) => d.kind === "videoinput"));
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const videoBase = {
        facingMode: "user" as const,
        width: { ideal: 640 },
        height: { ideal: 480 },
        aspectRatio: { ideal: 4 / 3 },
      };
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { ...videoBase, deviceId: { exact: deviceId } }
          : videoBase,
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        await video.play();
      }
      setActive(true);
      await refreshDevices();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Não foi possível acessar a câmera";
      const hint =
        typeof location !== "undefined" &&
        location.protocol !== "https:" &&
        location.hostname !== "localhost"
          ? " Em telemóvel é necessário HTTPS para a câmera."
          : "";
      setError(msg + hint);
      setActive(false);
    }
  }, [deviceId, refreshDevices]);

  useEffect(() => () => stop(), [stop]);

  return {
    videoRef,
    active,
    error,
    devices,
    deviceId,
    setDeviceId,
    start,
    stop,
    refreshDevices,
  };
}
