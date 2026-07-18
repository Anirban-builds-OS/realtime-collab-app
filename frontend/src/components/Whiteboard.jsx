import React, { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

// Fixed internal resolution so strokes line up identically for every
// participant regardless of their own window size — the canvas is scaled
// to fit via CSS while coordinates stay consistent.
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 700;

const COLORS = ["#e7eaf0", "#2dd4bf", "#8b7fff", "#f2545b", "#f5c451"];

export default function Whiteboard({ socket, roomId }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  const [color, setColor] = useState(COLORS[0]);
  const [lineWidth, setLineWidth] = useState(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#0f1320";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctxRef.current = ctx;
  }, []);

  useEffect(() => {
    const sock = socket.current;
    if (!sock) return;

    function drawStroke({ x0, y0, x1, y1, strokeColor, width }) {
      const ctx = ctxRef.current;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    function clearCanvas() {
      const ctx = ctxRef.current;
      ctx.fillStyle = "#0f1320";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    sock.on("whiteboard-draw", drawStroke);
    sock.on("whiteboard-clear", clearCanvas);

    return () => {
      sock.off("whiteboard-draw", drawStroke);
      sock.off("whiteboard-clear", clearCanvas);
    };
  }, [socket]);

  function getCanvasPoint(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  }

  function handleStart(e) {
    drawingRef.current = true;
    lastPointRef.current = getCanvasPoint(e);
  }

  function handleMove(e) {
    if (!drawingRef.current) return;
    const point = getCanvasPoint(e);
    const { x: x0, y: y0 } = lastPointRef.current;

    const ctx = ctxRef.current;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    socket.current?.emit("whiteboard-draw", {
      room: roomId,
      stroke: { x0, y0, x1: point.x, y1: point.y, strokeColor: color, width: lineWidth },
    });

    lastPointRef.current = point;
  }

  function handleEnd() {
    drawingRef.current = false;
  }

  function handleClear() {
    const ctx = ctxRef.current;
    ctx.fillStyle = "#0f1320";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    socket.current?.emit("whiteboard-clear", { room: roomId });
  }

  return (
    <div className="whiteboard-panel">
      <div className="whiteboard-toolbar">
        <div className="color-swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch ${color === c ? "selected" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Select color ${c}`}
            />
          ))}
        </div>
        <input
          type="range"
          min="1"
          max="12"
          value={lineWidth}
          onChange={(e) => setLineWidth(Number(e.target.value))}
        />
        <button className="btn btn-ghost" onClick={handleClear}>
          <Trash2 size={14} /> Clear
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="whiteboard-canvas"
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />
    </div>
  );
}
