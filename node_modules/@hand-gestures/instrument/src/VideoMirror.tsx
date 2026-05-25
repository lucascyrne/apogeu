import type { RefObject } from "react";

type Props = {
  videoRef: RefObject<HTMLVideoElement>;
  visible: boolean;
};

export function VideoMirror({ videoRef, visible }: Props) {
  return (
    <video
      ref={videoRef}
      className={`camera-mirror ${visible ? "visible" : ""}`}
      playsInline
      muted
      aria-hidden
    />
  );
}
