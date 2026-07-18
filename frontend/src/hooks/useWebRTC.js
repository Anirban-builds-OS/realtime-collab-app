import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "../socket.js";

// Public STUN servers are enough to discover a peer's public IP for most
// direct connections. Behind symmetric NATs / restrictive firewalls you'd
// add a TURN server here too — see the README's "Production notes" section.
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * Manages a full-mesh WebRTC session for a room: one RTCPeerConnection per
 * remote participant, all signaled through a single Socket.io connection.
 */
export function useWebRTC(roomId) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> { stream, name }
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState("");

  const socketRef = useRef(null);
  const peersRef = useRef(new Map()); // socketId -> RTCPeerConnection
  const localStreamRef = useRef(null);
  const cameraTrackRef = useRef(null); // original camera video track, saved during screen share

  const createPeerConnection = useCallback((peerId, peerName) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Attach our current local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("signal", {
          to: peerId,
          signalData: { type: "candidate", candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => ({
        ...prev,
        [peerId]: { stream: event.streams[0], name: peerName || prev[peerId]?.name || "Peer" },
      }));
    };

    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        // Leave cleanup to the explicit "user-left" handler; a transient
        // "disconnected" state can recover on its own.
      }
    };

    peersRef.current.set(peerId, pc);
    return pc;
  }, []);

  const closePeer = useCallback((peerId) => {
    const pc = peersRef.current.get(peerId);
    if (pc) {
      pc.close();
      peersRef.current.delete(peerId);
    }
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const socket = getSocket();
    socketRef.current = socket;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        cameraTrackRef.current = stream.getVideoTracks()[0] || null;
        setLocalStream(stream);
      } catch (err) {
        console.error("[webrtc] getUserMedia failed:", err);
        setError(
          "Could not access camera/microphone. Check browser permissions and try again."
        );
      }

      if (!cancelled) {
        socket.connect();
        socket.emit("join-room", { room: roomId });
      }
    }

    // --- Signaling event handlers ---------------------------------------

    async function handleExistingPeers(peers) {
      // We're the newcomer: initiate an offer to each peer already in the room.
      for (const peer of peers) {
        const pc = createPeerConnection(peer.socketId, peer.name);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("signal", {
            to: peer.socketId,
            signalData: { type: "offer", sdp: offer, name: undefined },
          });
        } catch (err) {
          console.error("[webrtc] offer creation failed:", err);
        }
      }
    }

    function handleUserJoined(peer) {
      // The new participant will send us an offer; just remember their name
      // by pre-registering an entry so ontrack can label it correctly.
      setRemoteStreams((prev) => ({
        ...prev,
        [peer.socketId]: prev[peer.socketId] || { stream: null, name: peer.name },
      }));
    }

    async function handleSignal({ from, fromName, signalData }) {
      let pc = peersRef.current.get(from);

      if (signalData.type === "offer") {
        if (!pc) pc = createPeerConnection(from, fromName);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("signal", {
            to: from,
            signalData: { type: "answer", sdp: answer },
          });
        } catch (err) {
          console.error("[webrtc] handling offer failed:", err);
        }
      } else if (signalData.type === "answer") {
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          } catch (err) {
            console.error("[webrtc] handling answer failed:", err);
          }
        }
      } else if (signalData.type === "candidate") {
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
          } catch (err) {
            console.error("[webrtc] addIceCandidate failed:", err);
          }
        }
      }
    }

    function handleUserLeft({ socketId }) {
      closePeer(socketId);
    }

    socket.on("existing-peers", handleExistingPeers);
    socket.on("user-joined", handleUserJoined);
    socket.on("signal", handleSignal);
    socket.on("user-left", handleUserLeft);
    socket.on("connect_error", (err) => {
      setError(`Connection error: ${err.message}`);
    });

    init();

    return () => {
      cancelled = true;
      socket.emit("leave-room");
      socket.off("existing-peers", handleExistingPeers);
      socket.off("user-joined", handleUserJoined);
      socket.off("signal", handleSignal);
      socket.off("user-left", handleUserLeft);

      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, createPeerConnection, closePeer]);

  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setAudioEnabled(track.enabled);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setVideoEnabled(track.enabled);
    }
  }, []);

  const replaceOutgoingVideoTrack = useCallback((newTrack) => {
    peersRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
      if (sender) sender.replaceTrack(newTrack);
    });
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = displayStream.getVideoTracks()[0];

      replaceOutgoingVideoTrack(screenTrack);

      // Swap the track shown in our own preview too.
      if (localStreamRef.current && cameraTrackRef.current) {
        localStreamRef.current.removeTrack(cameraTrackRef.current);
        localStreamRef.current.addTrack(screenTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

      setIsScreenSharing(true);
      socketRef.current.emit("screen-share-status", { room: roomId, sharing: true });

      // If the user stops sharing via the browser's native "Stop sharing" UI
      screenTrack.onended = () => stopScreenShare();
    } catch (err) {
      console.error("[webrtc] screen share failed:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replaceOutgoingVideoTrack, roomId]);

  const stopScreenShare = useCallback(async () => {
    if (!cameraTrackRef.current) return;

    try {
      // Re-acquire the camera (the original track may have been stopped by
      // the browser once screen sharing ended).
      const freshStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const freshCameraTrack = freshStream.getVideoTracks()[0];
      cameraTrackRef.current = freshCameraTrack;

      replaceOutgoingVideoTrack(freshCameraTrack);

      if (localStreamRef.current) {
        const oldVideo = localStreamRef.current.getVideoTracks()[0];
        if (oldVideo) {
          localStreamRef.current.removeTrack(oldVideo);
          oldVideo.stop();
        }
        localStreamRef.current.addTrack(freshCameraTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

      setIsScreenSharing(false);
      socketRef.current.emit("screen-share-status", { room: roomId, sharing: false });
    } catch (err) {
      console.error("[webrtc] stopping screen share failed:", err);
    }
  }, [replaceOutgoingVideoTrack, roomId]);

  return {
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
    socket: socketRef,
  };
}
