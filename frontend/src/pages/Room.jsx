import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useWebRTC } from "../hooks/useWebRTC.js";
import VideoGrid from "../components/VideoGrid.jsx";
import Controls from "../components/Controls.jsx";
import Whiteboard from "../components/Whiteboard.jsx";
import Chat from "../components/Chat.jsx";
import FileShare from "../components/FileShare.jsx";
import "../styles/room.css";

export default function Room() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activePanel, setActivePanel] = useState(null);

  const {
    localStream,
    remoteStreams,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    error,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    socket,
  } = useWebRTC(roomId);

  function handleLeave() {
    navigate("/");
  }

  return (
    <div className="room-shell">
      {error && <div className="room-banner error">{error}</div>}

      <div className="room-body">
        <VideoGrid localStream={localStream} localName={user?.name} remoteStreams={remoteStreams} />

        {activePanel && (
          <aside className="side-panel">
            <div className="side-panel-header">
              <span>
                {activePanel === "whiteboard" && "Whiteboard"}
                {activePanel === "chat" && "Chat"}
                {activePanel === "files" && "Shared files"}
              </span>
              <button className="btn btn-ghost" onClick={() => setActivePanel(null)}>
                Close
              </button>
            </div>
            {activePanel === "whiteboard" && <Whiteboard socket={socket} roomId={roomId} />}
            {activePanel === "chat" && <Chat socket={socket} roomId={roomId} />}
            {activePanel === "files" && <FileShare socket={socket} roomId={roomId} />}
          </aside>
        )}
      </div>

      <Controls
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        isScreenSharing={isScreenSharing}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={isScreenSharing ? stopScreenShare : startScreenShare}
        activePanel={activePanel}
        onSetPanel={setActivePanel}
        onLeave={handleLeave}
        roomId={roomId}
      />
    </div>
  );
}
