"use client";

import { useEffect, useRef, useState } from "react";
import { use } from "react";

const DEMOS: Record<string, { src: string; title: string }> = {
  "property-id": {
    src: "/Get Property ID.mp4",
    title: "How to Find Your GA4 Property ID",
  },
  "viewer-permission": {
    src: "/give viewer permission.mp4",
    title: "How to Give Viewer Permission in GA4",
  },
};

export default function DemoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const demo = DEMOS[slug];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().then(() => setPlaying(true)).catch(() => {});
  }, []);

  const resetHideTimer = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 3000);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
      setShowControls(true);
    }
    resetHideTimer();
  };

  const seek = (secs: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + secs));
    resetHideTimer();
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setProgress(v.currentTime);
    setDuration(v.duration || 0);
  };

  const handleSeekBar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = parseFloat(e.target.value);
    setProgress(v.currentTime);
    resetHideTimer();
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  if (!demo) {
    return (
      <div style={{ background: "#000", minHeight: "100vh", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
        Demo not found.
      </div>
    );
  }

  return (
    <div
      style={{ background: "#000", minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", userSelect: "none" }}
      onMouseMove={resetHideTimer}
      onClick={togglePlay}
    >
      {/* Title */}
      <div
        style={{
          position: "fixed", top: 0, left: 0, right: 0,
          padding: "24px 32px",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)",
          color: "white", fontSize: "15px", fontWeight: 600,
          opacity: showControls ? 1 : 0,
          transition: "opacity 0.3s ease",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        {demo.title}
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        src={demo.src}
        style={{ width: "100%", maxHeight: "100vh", objectFit: "contain", display: "block" }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={() => { setPlaying(false); setShowControls(true); }}
        playsInline
        preload="auto"
      />

      {/* Controls bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          padding: "20px 32px 32px",
          background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
          opacity: showControls ? 1 : 0,
          transition: "opacity 0.3s ease",
          zIndex: 10,
        }}
      >
        {/* Seek bar */}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={progress}
          onChange={handleSeekBar}
          style={{
            width: "100%",
            height: "4px",
            appearance: "none",
            background: `linear-gradient(to right, #7C3AED ${(progress / (duration || 1)) * 100}%, rgba(255,255,255,0.3) 0%)`,
            borderRadius: "4px",
            cursor: "pointer",
            marginBottom: "16px",
            outline: "none",
          }}
        />

        {/* Three buttons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "24px" }}>
          {/* Seek -5s */}
          <button
            onClick={() => seek(-5)}
            style={btnStyle}
            title="Rewind 5 seconds"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
              <text x="7" y="15" fontSize="6" fill="white" fontWeight="bold">5</text>
            </svg>
          </button>

          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            style={{ ...btnStyle, width: "64px", height: "64px", borderRadius: "50%", background: "#7C3AED" }}
            title={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
            )}
          </button>

          {/* Seek +5s */}
          <button
            onClick={() => seek(5)}
            style={btnStyle}
            title="Forward 5 seconds"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
              <text x="9" y="15" fontSize="6" fill="white" fontWeight="bold">5</text>
            </svg>
          </button>
        </div>

        {/* Timestamp */}
        <div style={{ textAlign: "center", marginTop: "12px", fontSize: "13px", color: "rgba(255,255,255,0.5)", letterSpacing: "0.05em" }}>
          {fmt(progress)} / {fmt(duration)}
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  border: "none",
  borderRadius: "50%",
  width: "52px",
  height: "52px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "background 0.15s ease",
  backdropFilter: "blur(4px)",
};
