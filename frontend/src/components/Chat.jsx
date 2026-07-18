import React, { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { getSocket } from "../socket.js";

export default function Chat({ socket, roomId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    const sock = socket.current || getSocket();
    socket.current = sock;

    function handleMessage(msg) {
      setMessages((prev) => [...prev, msg]);
    }

    sock.on("chat-message", handleMessage);
    return () => sock.off("chat-message", handleMessage);
  }, [socket, roomId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    const sock = socket.current || getSocket();
    socket.current = sock;

    if (!sock.connected) sock.connect();

    const optimisticMessage = {
      from: user?.name || "You",
      message: trimmed,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    sock.emit("chat-message", { room: roomId, message: trimmed });
    setText("");
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && <p className="chat-empty">No messages yet — say hello.</p>}
        {messages.map((m, i) => (
          <div key={i} className="chat-message">
            <span className="chat-author">{m.from}</span>
            <span className="chat-time">
              {new Date(m.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <p>{m.message}</p>
          </div>
        ))}
      </div>
      <form className="chat-input-row" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Message the room…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" aria-label="Send message">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
