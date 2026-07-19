import React, { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

export default function Chat({ socket, roomId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    const sock = socket.current;
    if (!sock) return;

    function handleMessage(msg) {
      setMessages((prev) => {
        const alreadyExists = prev.some((existing) => existing.id && existing.id === msg.id);
        if (alreadyExists) return prev;
        return [...prev, msg];
      });
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

    const sock = socket.current;
    if (!sock) return;

    sock.emit("chat-message", { room: roomId, message: trimmed });
    setText("");
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && <p className="chat-empty">No messages yet — say hello.</p>}
        {messages.map((m, i) => (
          <div key={m.id || `${m.from}-${m.timestamp}-${i}`} className="chat-message">
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
