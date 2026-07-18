import React, { useEffect, useRef } from "react";

export default function VideoTile({ stream, name, muted = false, isLocal = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideo = stream && stream.getVideoTracks().some((t) => t.enabled);

  return (
    <div className="video-tile">
      {stream ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} />
      ) : (
        <div className="video-placeholder">Connecting…</div>
      )}
      {!hasVideo && stream && (
        <div className="video-placeholder overlay">{name?.[0]?.toUpperCase() || "?"}</div>
      )}
      <span className="video-label">
        {name} {isLocal && "(You)"}
      </span>
    </div>
  );
}
