import { useEffect, useRef, useState, useCallback } from "react";
import "../styles/callview.css";

export default function CallView({ socket, workspaceId, user }) {
  const [participants, setParticipants] = useState([]);
  const [inCall,       setInCall]       = useState(false);
  const [muted,        setMuted]        = useState(false);
  const [connecting,   setConnecting]   = useState(false);
  const [error,        setError]        = useState("");

  const localStreamRef = useRef(null);
  const peersRef       = useRef({});
  const audioRefs      = useRef({});

  const cleanupPeer = useCallback((socketId) => {
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].destroy();
      delete peersRef.current[socketId];
    }
    if (audioRefs.current[socketId]) {
      audioRefs.current[socketId].srcObject = null;
      delete audioRefs.current[socketId];
    }
  }, []);

  const createPeer = useCallback((targetSocketId, initiator, stream) => {
    const SimplePeer = require("simple-peer");

    const peer = new SimplePeer({
      initiator,
      trickle: true,
      stream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ]
      }
    });

    peer.on("signal", (signalData) => {
      if (signalData.type === "offer") {
        socket.emit("call-offer", { targetSocketId, offer: signalData, callType: "audio" });
      } else if (signalData.type === "answer") {
        socket.emit("call-answer", { targetSocketId, answer: signalData });
      } else {
        socket.emit("call-ice-candidate", { targetSocketId, candidate: signalData });
      }
    });

    peer.on("stream", (remoteStream) => {
      let audio = audioRefs.current[targetSocketId];
      if (!audio) {
        audio = new Audio();
        audioRefs.current[targetSocketId] = audio;
      }
      audio.srcObject = remoteStream;
      audio.play().catch(console.error);
    });

    peer.on("error", (e) => console.error("Peer error:", e));
    peer.on("close", () => cleanupPeer(targetSocketId));

    peersRef.current[targetSocketId] = peer;
    return peer;
  }, [socket, cleanupPeer]);

  useEffect(() => {
    if (!socket) return;

    const onUserJoined = ({ socketId, username, callType }) => {
      if (!localStreamRef.current) return;
      setParticipants((prev) => {
        if (prev.find((p) => p.socketId === socketId)) return prev;
        return [...prev, { socketId, username, callType }];
      });
      createPeer(socketId, true, localStreamRef.current);
    };

    const onExistingParticipants = ({ participants: existing }) => {
      existing.forEach(({ socketId, username, callType }) => {
        if (!localStreamRef.current) return;
        createPeer(socketId, true, localStreamRef.current);
        setParticipants((prev) => {
          if (prev.find((p) => p.socketId === socketId)) return prev;
          return [...prev, { socketId, username, callType }];
        });
      });
    };

    const onOffer = ({ fromSocketId, fromUsername, offer }) => {
      if (!localStreamRef.current) return;
      let peer = peersRef.current[fromSocketId];
      if (!peer) peer = createPeer(fromSocketId, false, localStreamRef.current);
      peer.signal(offer);
      setParticipants((prev) => {
        if (prev.find((p) => p.socketId === fromSocketId)) return prev;
        return [...prev, { socketId: fromSocketId, username: fromUsername }];
      });
    };

    const onAnswer = ({ fromSocketId, answer }) => {
      const p = peersRef.current[fromSocketId];
      if (p) p.signal(answer);
    };

    const onIceCandidate = ({ fromSocketId, candidate }) => {
      const p = peersRef.current[fromSocketId];
      if (p) p.signal(candidate);
    };

    const onUserLeft = ({ socketId, username }) => {
      console.log(`📴 ${username} left`);
      cleanupPeer(socketId);
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    };

    const onCallEnded = () => leaveCall(false);

    socket.on("call-user-joined",          onUserJoined);
    socket.on("call-existing-participants", onExistingParticipants);
    socket.on("call-offer",                onOffer);
    socket.on("call-answer",               onAnswer);
    socket.on("call-ice-candidate",        onIceCandidate);
    socket.on("call-user-left",            onUserLeft);
    socket.on("call-ended",               onCallEnded);

    return () => {
      socket.off("call-user-joined",          onUserJoined);
      socket.off("call-existing-participants", onExistingParticipants);
      socket.off("call-offer",                onOffer);
      socket.off("call-answer",               onAnswer);
      socket.off("call-ice-candidate",        onIceCandidate);
      socket.off("call-user-left",            onUserLeft);
      socket.off("call-ended",               onCallEnded);
    };
  }, [socket, createPeer, cleanupPeer]); // eslint-disable-line react-hooks/exhaustive-deps

  const joinCall = async () => {
    setError("");
    setConnecting(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Media devices not available. Please restart the app.");
        setConnecting(false);
        return;
      }

      // ✅ Enumerate devices first
      const devices  = await navigator.mediaDevices.enumerateDevices();
      const hasAudio = devices.some((d) => d.kind === "audioinput");
      console.log("🎤 Audio devices:", devices.filter((d) => d.kind === "audioinput"));

      if (!hasAudio) {
        setError("No microphone detected. Please connect a microphone.");
        setConnecting(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      console.log("✅ Got audio stream:", stream.getTracks());
      localStreamRef.current = stream;
      setInCall(true);
      setConnecting(false);
      socket.emit("call-join", { workspaceId, callType: "audio" });

    } catch (err) {
      console.error("Mic error:", err.name, err.message);

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Microphone permission denied. Please allow access in system settings.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setError("No microphone found. Please connect one and try again.");
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        setError("Microphone is in use by another application.");
      } else if (err.name === "OverconstrainedError") {
        setError("Microphone does not meet requirements. Try a different device.");
      } else {
        setError(`Could not access microphone: ${err.name} — ${err.message}`);
      }

      setConnecting(false);
    }
  };

  const leaveCall = useCallback((notify = true) => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    Object.keys(peersRef.current).forEach(cleanupPeer);
    peersRef.current = {};
    setInCall(false);
    setParticipants([]);
    setMuted(false);
    if (notify && socket) socket.emit("call-leave", { workspaceId });
  }, [socket, workspaceId, cleanupPeer]);

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMuted(!track.enabled); }
  };

  useEffect(() => { return () => leaveCall(true); }, [leaveCall]);

  return (
    <div className="call-container">
      <div className="call-header">
        <div className="call-header-left">
          <span className="call-header-icon">📞</span>
          <h3>Voice Call</h3>
          {inCall && <span className="call-live-badge">● LIVE</span>}
        </div>
        <span className="call-header-sub">
          {workspaceId ? `#${workspaceId.slice(-6)}` : "—"}
        </span>
      </div>

      <div className="call-body">
        {error && <div className="call-error">{error}</div>}

        {!inCall ? (
          <div className="call-join-screen">
            <div className="call-join-icon">📞</div>
            <h3>Voice Channel</h3>
            <p>
              {participants.length > 0
                ? `${participants.length} person${participants.length > 1 ? "s" : ""} in call`
                : "No one in call yet"}
            </p>
            <button
              className="call-btn-join"
              onClick={joinCall}
              disabled={connecting}
            >
              {connecting ? "Connecting..." : "Join Call"}
            </button>
          </div>
        ) : (
          <>
            <div className="call-participants">
              <div className="call-participant self">
                <div className={`call-avatar ${muted ? "muted" : "active"}`}>
                  {user?.username?.[0]?.toUpperCase()}
                </div>
                <span className="call-participant-name">
                  {user?.username} (you)
                </span>
                <span className="call-participant-status">
                  {muted ? "🔇" : "🎙️"}
                </span>
              </div>

              {participants.map((p) => (
                <div key={p.socketId} className="call-participant">
                  <div className="call-avatar active">
                    {p.username?.[0]?.toUpperCase()}
                  </div>
                  <span className="call-participant-name">{p.username}</span>
                  <span className="call-participant-status">🎙️</span>
                </div>
              ))}
            </div>

            <div className="call-controls">
              <button
                className={`call-ctrl-btn ${muted ? "danger" : ""}`}
                onClick={toggleMute}
              >
                {muted ? "🔇" : "🎙️"}
                <span>{muted ? "Unmute" : "Mute"}</span>
              </button>
              <button
                className="call-ctrl-btn end"
                onClick={() => leaveCall(true)}
              >
                📴
                <span>Leave</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
