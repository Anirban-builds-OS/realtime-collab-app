import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/lobby.css";

function generateRoomCode() {
  // e.g. "kf3-9pq-x2m" — short, easy to read aloud, hard to collide
  const seg = () => Math.random().toString(36).slice(2, 5);
  return `${seg()}-${seg()}-${seg()}`;
}

export default function Lobby() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("create");
  const [joinCode, setJoinCode] = useState("");
  const [createdCode, setCreatedCode] = useState("");

  function handleCreate() {
    const code = generateRoomCode();
    setCreatedCode(code);
  }

  function enterRoom(code) {
    if (!code.trim()) return;
    navigate(`/room/${code.trim()}`);
  }

  return (
    <div className="lobby-shell">
      <header className="lobby-header">
        <div className="brand" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="pulse-dot" />
          Confluence
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "var(--text-muted)", fontSize: 14 }}>{user?.name}</span>
          <button className="btn btn-ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main className="lobby-main">
        <div className="lobby-card">
          <h2>Start collaborating</h2>
          <p className="subtitle">Create a new room or join one with a code.</p>

          <div className="lobby-tabs">
            <button
              className={mode === "create" ? "active" : ""}
              onClick={() => setMode("create")}
            >
              Create room
            </button>
            <button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}>
              Join room
            </button>
          </div>

          {mode === "create" ? (
            <>
              {!createdCode ? (
                <button className="btn btn-primary" onClick={handleCreate}>
                  Generate room code
                </button>
              ) : (
                <>
                  <div className="room-code-display">{createdCode}</div>
                  <button className="btn btn-primary" onClick={() => enterRoom(createdCode)}>
                    Enter room
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder="Enter room code, e.g. kf3-9pq-x2m"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enterRoom(joinCode)}
              />
              <button className="btn btn-primary" onClick={() => enterRoom(joinCode)}>
                Join room
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
