import React, { useEffect, useRef, useState } from "react";
import { Upload, Download, Lock } from "lucide-react";
import api from "../api/axios.js";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileShare({ socket, roomId }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    api
      .get(`/api/files/${roomId}`)
      .then((res) => setFiles(res.data.files))
      .catch(() => setError("Could not load shared files."));
  }, [roomId]);

  useEffect(() => {
    const sock = socket.current;
    if (!sock) return;

    function handleFileShared(file) {
      setFiles((prev) => [{ ...file, uploadedBy: file.sharedBy }, ...prev]);
    }

    sock.on("file-shared", handleFileShared);
    return () => sock.off("file-shared", handleFileShared);
  }, [socket]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post(`/api/files/${roomId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const uploaded = res.data.file;
      setFiles((prev) => [uploaded, ...prev]);
      socket.current?.emit("file-shared", { room: roomId, file: uploaded });
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDownload(file) {
    try {
      const res = await api.get(`/api/files/download/${file.id}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Download failed.");
    }
  }

  return (
    <div className="files-panel">
      <label className="upload-dropzone">
        <Upload size={18} />
        <span>{uploading ? "Uploading & encrypting…" : "Click to share a file"}</span>
        <small>
          <Lock size={11} /> Encrypted at rest with AES-256 · 25 MB max
        </small>
        <input
          ref={inputRef}
          type="file"
          hidden
          onChange={handleUpload}
          disabled={uploading}
        />
      </label>

      {error && <p className="error-text">{error}</p>}

      <div className="file-list">
        {files.length === 0 && !error && (
          <p className="chat-empty">No files shared in this room yet.</p>
        )}
        {files.map((file) => (
          <div className="file-row" key={file.id}>
            <div className="file-meta">
              <span className="file-name">{file.name}</span>
              <span className="file-sub">
                {formatSize(file.size)} · shared by {file.uploadedBy}
              </span>
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => handleDownload(file)}
              aria-label={`Download ${file.name}`}
            >
              <Download size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
