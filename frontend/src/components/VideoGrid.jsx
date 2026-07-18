import React from "react";
import VideoTile from "./VideoTile.jsx";

export default function VideoGrid({ localStream, localName, remoteStreams }) {
  const remoteEntries = Object.entries(remoteStreams);
  const tileCount = remoteEntries.length + 1;

  return (
    <div className="video-grid" data-count={Math.min(tileCount, 9)}>
      <VideoTile stream={localStream} name={localName} muted isLocal />
      {remoteEntries.map(([socketId, { stream, name }]) => (
        <VideoTile key={socketId} stream={stream} name={name} />
      ))}
    </div>
  );
}
