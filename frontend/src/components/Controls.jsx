import React, { useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  PenSquare,
  MessageSquare,
  FileUp,
  PhoneOff,
  Copy,
  Check,
} from "lucide-react";

export default function Controls({
  audioEnabled,
  videoEnabled,
  isScreenSharing,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  activePanel,
  onSetPanel,
  onLeave,
  roomId,
}) {
  const [copied, setCopied] = useState(false);

  function copyRoomCode() {
    navigator.clipboard?.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="controls-dock">
      <button className="room-code-chip" onClick={copyRoomCode} title="Copy room code">
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {roomId}
      </button>

      <div className="controls-center">
        <button
          className={`control-btn ${!audioEnabled ? "off" : ""}`}
          onClick={onToggleAudio}
          title={audioEnabled ? "Mute microphone" : "Unmute microphone"}
        >
          {audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        <button
          className={`control-btn ${!videoEnabled ? "off" : ""}`}
          onClick={onToggleVideo}
          title={videoEnabled ? "Turn off camera" : "Turn on camera"}
        >
          {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        <button
          className={`control-btn ${isScreenSharing ? "active" : ""}`}
          onClick={onToggleScreenShare}
          title={isScreenSharing ? "Stop sharing screen" : "Share screen"}
        >
          {isScreenSharing ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
        </button>

        <button
          className={`control-btn ${activePanel === "whiteboard" ? "active" : ""}`}
          onClick={() => onSetPanel(activePanel === "whiteboard" ? null : "whiteboard")}
          title="Whiteboard"
        >
          <PenSquare size={20} />
        </button>

        <button
          className={`control-btn ${activePanel === "chat" ? "active" : ""}`}
          onClick={() => onSetPanel(activePanel === "chat" ? null : "chat")}
          title="Chat"
        >
          <MessageSquare size={20} />
        </button>

        <button
          className={`control-btn ${activePanel === "files" ? "active" : ""}`}
          onClick={() => onSetPanel(activePanel === "files" ? null : "files")}
          title="Shared files"
        >
          <FileUp size={20} />
        </button>

        <button className="control-btn leave" onClick={onLeave} title="Leave call">
          <PhoneOff size={20} />
        </button>
      </div>

      <div className="controls-spacer" />
    </div>
  );
}
