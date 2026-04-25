import { useEffect, useRef, useState, useCallback } from "react";
import "../styles/callview.css";

export default function VideoView({ socket, workspaceId, user }) {
  const [participants, setParticipants] = useState([]);
  const [inCall,       setInCall]       = useState(false);
  const [muted,        setMuted]        = useState(false);
  const [videoOff,     setVideoOff]     = useState(false);
  const [connecting,   setConnecting]   = useState(false);
  const [error,        setError]        = useState("");

  const localStreamRef = useRef(null);
  const localVideoRef  = useRef(null);
  const peersRef       = useRef({});
  const videoRefs      = useRef({});

  const cleanupPeer = useCallback((socketId) => {
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].destroy();
      delete peersRef.current[socketId];
    }
    delete videoRefs.current[socketId];
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
        socket.emit("call-offer", { targetSocketId, offer: signalData, callType: "video" });
      } else if (signalData.type === "answer") {
        socket.emit("call-answer", { targetSocketId, answer: signalData });
      } else {
        socket.emit("call-ice-candidate", { targetSocketId, candidate: signalData });
      }
    });

    peer.on("stream", (remoteStream) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.socketId === targetSocketId ? { ...p, stream: remoteStream } : p
        )
      );
    });

    peer.on("error", (e) => console.error("Peer error:", e));
    peer.on("close", () => cleanupPeer(targetSocketId));

    peersRef.current[targetSocketId] = peer;
    return peer;
  }, [socket, cleanupPeer]);

  useEffect(() => {
    if (!socket) return;

    const onUserJoined = ({ socketId, username }) => {
      if (!localStreamRef.current) return;
      setParticipants((prev) => {
        if (prev.find((p) => p.socketId === socketId)) return prev;
        return [...prev, { socketId, username, stream: null }];
      });
      createPeer(socketId, true, localStreamRef.current);
    };

    const onExistingParticipants = ({ participants: existing }) => {
      existing.forEach(({ socketId, username }) => {
        if (!localStreamRef.current) return;
        createPeer(socketId, true, localStreamRef.current);
        setParticipants((prev) => {
          if (prev.find((p) => p.socketId === socketId)) return prev;
          return [...prev, { socketId, username, stream: null }];
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
        return [...prev, { socketId: fromSocketId, username: fromUsername, stream: null }];
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

  useEffect(() => {
    participants.forEach((p) => {
      if (p.stream && videoRefs.current[p.socketId]) {
        videoRefs.current[p.socketId].srcObject = p.stream;
      }
    });
  }, [participants]);

  const joinCall = async () => {
    setError("");
    setConnecting(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Media devices not available. Please restart the app.");
        setConnecting(false);
        return;
      }

      // ✅ Check available devices first
      const devices  = await navigator.mediaDevices.enumerateDevices();
      const hasAudio = devices.some((d) => d.kind === "audioinput");
      const hasVideo = devices.some((d) => d.kind === "videoinput");

      console.log("🎤 Audio devices:", devices.filter((d) => d.kind === "audioinput"));
      console.log("📹 Video devices:", devices.filter((d) => d.kind === "videoinput"));

      if (!hasAudio && !hasVideo) {
        setError("No camera or microphone detected.");
        setConnecting(false);
        return;
      }

      let stream;

      try {
        // ✅ Request only what's available
        stream = await navigator.mediaDevices.getUserMedia({
          audio: hasAudio,
          video: hasVideo
        });
      } catch (firstErr) {
        console.warn("First attempt failed:", firstErr.name);

        // ✅ Fallback — try audio only
        if (hasAudio) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false
            });
            setError("Camera unavailable — joining with audio only.");
          } catch (audioErr) {
            throw audioErr;
          }
        } else {
          throw firstErr;
        }
      }

      console.log("✅ Got stream:", stream.getTracks());
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setInCall(true);
      setConnecting(false);
      socket.emit("call-join", { workspaceId, callType: "video" });

    } catch (err) {
      console.error("Camera/mic error:", err.name, err.message);

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Permission denied. Please allow camera/microphone in system settings.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setError("No devices found. Please connect a camera/microphone.");
      } else if (err.name === "NotReadableError") {
        setError("Device is in use by another application.");
      } else if (err.name === "OverconstrainedError") {
        setError("Device constraints not satisfied. Trying simpler configuration...");
        // Last resort — try with no constraints
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
          });
          localStreamRef.current = stream;
          setInCall(true);
          setError("Joined with audio only.");
          socket.emit("call-join", { workspaceId, callType: "audio" });
        } catch (e) {
          setError(`Failed: ${e.message}`);
        }
      } else {
        setError(`Error: ${err.name} — ${err.message}`);
      }

      setConnecting(false);
    }
  };

  const leaveCall = useCallback((notify = true) => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    Object.keys(peersRef.current).forEach(cleanupPeer);
    peersRef.current = {};
    setInCall(false);
    setParticipants([]);
    setMuted(false);
    setVideoOff(false);
    if (notify && socket) socket.emit("call-leave", { workspaceId });
  }, [socket, workspaceId, cleanupPeer]);

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMuted(!track.enabled); }
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setVideoOff(!track.enabled); }
  };

  useEffect(() => { return () => leaveCall(true); }, [leaveCall]);

  return (
    <div className="call-container">
      <div className="call-header">
        <div className="call-header-left">
          <span className="call-header-icon">📹</span>
          <h3>Video Call</h3>
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
            <div className="call-join-icon">📹</div>
            <h3>Video Channel</h3>
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
              {connecting ? "Connecting..." : "Join Video Call"}
            </button>
          </div>
        ) : (
          <>
            <div className={`video-grid participants-${participants.length + 1}`}>
              <div className="video-tile self">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={videoOff ? "video-off" : ""}
                />
                {videoOff && (
                  <div className="video-avatar">
                    {user?.username?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="video-tile-name">
                  {user?.username} (you){muted && " 🔇"}
                </div>
              </div>

              {participants.map((p) => (
                <div key={p.socketId} className="video-tile">
                  {p.stream ? (
                    <video
                      ref={(el) => {
                        if (el) {
                          videoRefs.current[p.socketId] = el;
                          if (p.stream) el.srcObject = p.stream;
                        }
                      }}
                      autoPlay
                      playsInline
                    />
                  ) : (
                    <div className="video-avatar">
                      {p.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="video-tile-name">{p.username}</div>
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
                className={`call-ctrl-btn ${videoOff ? "danger" : ""}`}
                onClick={toggleVideo}
              >
                {videoOff ? "📵" : "📹"}
                <span>{videoOff ? "Start Video" : "Stop Video"}</span>
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
