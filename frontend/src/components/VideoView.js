import { useEffect, useRef, useState, useCallback } from "react";
import { useSpeakingDetection } from "../hooks/useSpeakingDetection";
import "../styles/callview.css";

export default function VideoView({ socket, workspaceId, user }) {
  const [participants, setParticipants] = useState([]);
  const [inCall,       setInCall]       = useState(false);
  const [muted,        setMuted]        = useState(false);
  const [videoOff,     setVideoOff]     = useState(false);
  const [connecting,   setConnecting]   = useState(false);
  const [error,        setError]        = useState("");

  // 🖥️ screen share state
  const [screenSharing,    setScreenSharing]    = useState(false);
  const [remoteSharing,    setRemoteSharing]    = useState({}); // { socketId: true }

  const localStreamRef = useRef(null);
  const localVideoRef  = useRef(null);
  const peersRef       = useRef({});
  const videoRefs      = useRef({});
  const videoRefCallbacksRef = useRef({});
  const pendingCandidatesRef = useRef({});

  // 🖥️ screen share refs
  const screenStreamRef = useRef(null);
  const cameraTrackRef  = useRef(null); // holds the camera track while screen sharing is active

  const { speakingMap, startMonitor, stopMonitor, stopAll } = useSpeakingDetection(18);

  const cleanupPeer = useCallback((socketId) => {
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].destroy();
      delete peersRef.current[socketId];
    }
    delete videoRefs.current[socketId];
    delete videoRefCallbacksRef.current[socketId];
    delete pendingCandidatesRef.current[socketId];
    stopMonitor(socketId);
  }, [stopMonitor]);

  const createPeer = useCallback((targetSocketId, initiator, stream) => {
    const SimplePeer = require("simple-peer");

    console.log(`🔧 Creating peer -> ${targetSocketId} (initiator: ${initiator}, tracks: ${stream?.getTracks().map(t => t.kind).join(",")})`);

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
        console.log(`📤 Sending OFFER -> ${targetSocketId}`);
        socket.emit("call-offer", { targetSocketId, offer: signalData, callType: "video" });
      } else if (signalData.type === "answer") {
        console.log(`📤 Sending ANSWER -> ${targetSocketId}`);
        socket.emit("call-answer", { targetSocketId, answer: signalData });
      } else {
        socket.emit("call-ice-candidate", { targetSocketId, candidate: signalData });
      }
    });

    peer.on("connect", () => {
      console.log(`✅ PEER CONNECTED (data channel open) -> ${targetSocketId}`);
    });

    if (peer._pc) {
      peer._pc.oniceconnectionstatechange = () => {
        console.log(`🧊 ICE state (${targetSocketId}):`, peer._pc.iceConnectionState);
      };
      peer._pc.onconnectionstatechange = () => {
        console.log(`🔗 Connection state (${targetSocketId}):`, peer._pc.connectionState);
      };
    }

    peer.on("stream", (remoteStream) => {
      console.log(`🎥 STREAM RECEIVED <- ${targetSocketId}`, remoteStream.getTracks().map(t => `${t.kind}:${t.readyState}`));
      setParticipants((prev) =>
        prev.map((p) =>
          p.socketId === targetSocketId ? { ...p, stream: remoteStream } : p
        )
      );
      startMonitor(targetSocketId, remoteStream);
    });

    peer.on("error", (e) => console.error(`❌ Peer error (${targetSocketId}):`, e));
    peer.on("close", () => {
      console.log(`📴 Peer closed -> ${targetSocketId}`);
      cleanupPeer(targetSocketId);
    });

    peersRef.current[targetSocketId] = peer;

    if (pendingCandidatesRef.current[targetSocketId]) {
      pendingCandidatesRef.current[targetSocketId].forEach((c) => peer.signal(c));
      delete pendingCandidatesRef.current[targetSocketId];
    }

    return peer;
  }, [socket, cleanupPeer, startMonitor]);

  useEffect(() => {
    if (!socket) return;

    const onUserJoined = ({ socketId, username }) => {
      if (!localStreamRef.current) return;
      setParticipants((prev) => {
        if (prev.find((p) => p.socketId === socketId)) return prev;
        return [...prev, { socketId, username, stream: null }];
      });
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
      if (p) {
        p.signal(candidate);
      } else {
        if (!pendingCandidatesRef.current[fromSocketId]) {
          pendingCandidatesRef.current[fromSocketId] = [];
        }
        pendingCandidatesRef.current[fromSocketId].push(candidate);
      }
    };

    const onUserLeft = ({ socketId, username }) => {
      console.log(`📴 ${username} left`);
      cleanupPeer(socketId);
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
      setRemoteSharing((prev) => {
        if (!prev[socketId]) return prev;
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    const onCallEnded = () => leaveCall(false);

    // 🖥️ screen share labels — purely cosmetic, never touches media/peers
    const onScreenShareStart = ({ socketId }) => {
      setRemoteSharing((prev) => ({ ...prev, [socketId]: true }));
    };
    const onScreenShareStop = ({ socketId }) => {
      setRemoteSharing((prev) => {
        if (!prev[socketId]) return prev;
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    socket.on("call-user-joined",          onUserJoined);
    socket.on("call-existing-participants", onExistingParticipants);
    socket.on("call-offer",                onOffer);
    socket.on("call-answer",               onAnswer);
    socket.on("call-ice-candidate",        onIceCandidate);
    socket.on("call-user-left",            onUserLeft);
    socket.on("call-ended",               onCallEnded);
    socket.on("screen-share-start",       onScreenShareStart);
    socket.on("screen-share-stop",        onScreenShareStop);

    return () => {
      socket.off("call-user-joined",          onUserJoined);
      socket.off("call-existing-participants", onExistingParticipants);
      socket.off("call-offer",                onOffer);
      socket.off("call-answer",               onAnswer);
      socket.off("call-ice-candidate",        onIceCandidate);
      socket.off("call-user-left",            onUserLeft);
      socket.off("call-ended",               onCallEnded);
      socket.off("screen-share-start",       onScreenShareStart);
      socket.off("screen-share-stop",        onScreenShareStop);
    };
  }, [socket, createPeer, cleanupPeer]); // eslint-disable-line react-hooks/exhaustive-deps

  const getVideoRefCallback = useCallback((socketId) => {
    if (!videoRefCallbacksRef.current[socketId]) {
      videoRefCallbacksRef.current[socketId] = (el) => {
        if (el) {
          videoRefs.current[socketId] = el;
        } else {
          delete videoRefs.current[socketId];
        }
      };
    }
    return videoRefCallbacksRef.current[socketId];
  }, []);

  useEffect(() => {
    participants.forEach((p) => {
      if (p.stream && videoRefs.current[p.socketId]) {
        videoRefs.current[p.socketId].srcObject = p.stream;
      }
    });
  }, [participants]);

  useEffect(() => {
    if (inCall && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [inCall]);

  const joinCall = async () => {
    setError("");
    setConnecting(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Media devices not available. Please restart the app.");
        setConnecting(false);
        return;
      }

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
        stream = await navigator.mediaDevices.getUserMedia({
          audio: hasAudio,
          video: hasVideo
        });
      } catch (firstErr) {
        console.warn("First attempt failed:", firstErr.name);

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
      startMonitor("self", stream);

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
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
          });
          localStreamRef.current = stream;
          startMonitor("self", stream);
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

  // 🖥️ ── SCREEN SHARE ──────────────────────────────────────
  // Swaps the outgoing video track on every existing peer connection
  // via replaceTrack(). This does NOT renegotiate the connection or
  // touch offer/answer/ICE — same call, different pixels. Audio track
  // is never touched, so mute/call audio can't be affected by this.

  const swapTrackForAllPeers = (oldTrack, newTrack) => {
    Object.values(peersRef.current).forEach((peer) => {
      try {
        peer.replaceTrack(oldTrack, newTrack, localStreamRef.current);
      } catch (err) {
        console.error("replaceTrack failed for a peer (non-fatal):", err);
      }
    });
  };

  const startScreenShare = async () => {
    if (!localStreamRef.current) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setError("Screen sharing isn't supported in this app build.");
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return;

      const camTrack = localStreamRef.current.getVideoTracks()[0];
      cameraTrackRef.current = camTrack || null;
      screenStreamRef.current = screenStream;

      if (camTrack) {
        swapTrackForAllPeers(camTrack, screenTrack);
        localStreamRef.current.removeTrack(camTrack);
      }
      localStreamRef.current.addTrack(screenTrack);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      setScreenSharing(true);
      socket.emit("screen-share-start", { workspaceId });

      // If the user stops sharing via the browser/OS "Stop sharing" bar
      // instead of our button, revert automatically.
      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Screen share error:", err);
      if (err.name !== "NotAllowedError") {
        setError("Could not start screen share.");
      }
    }
  };

  const stopScreenShare = () => {
    if (!screenStreamRef.current) return;

    const screenTrack = screenStreamRef.current.getVideoTracks()[0];

    (async () => {
      try {
        let camTrack = cameraTrackRef.current;
        if (!camTrack || camTrack.readyState === "ended") {
          const freshStream = await navigator.mediaDevices.getUserMedia({ video: true });
          camTrack = freshStream.getVideoTracks()[0];
        }

        if (camTrack) {
          if (screenTrack) swapTrackForAllPeers(screenTrack, camTrack);
          if (screenTrack) localStreamRef.current.removeTrack(screenTrack);
          localStreamRef.current.addTrack(camTrack);
          cameraTrackRef.current = camTrack;
          camTrack.enabled = !videoOff;
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      } catch (err) {
        console.error("Failed to restore camera after screen share:", err);
      } finally {
        if (screenTrack) screenTrack.stop();
        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
        setScreenSharing(false);
        socket.emit("screen-share-stop", { workspaceId });
      }
    })();
  };

  const toggleScreenShare = () => {
    if (screenSharing) stopScreenShare();
    else startScreenShare();
  };

  const leaveCall = useCallback((notify = true) => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenSharing(false);
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    Object.keys(peersRef.current).forEach(cleanupPeer);
    peersRef.current = {};
    stopAll();
    setInCall(false);
    setParticipants([]);
    setMuted(false);
    setVideoOff(false);
    setRemoteSharing({});
    if (notify && socket) socket.emit("call-leave", { workspaceId });
  }, [socket, workspaceId, cleanupPeer, stopAll]);

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

  const selfSpeaking = !!speakingMap.self && !muted;

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
              <div className={`video-tile self ${selfSpeaking ? "speaking" : ""}`}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={videoOff && !screenSharing ? "video-off" : ""}
                />
                {videoOff && !screenSharing && (
                  <div className="video-avatar">
                    {user?.username?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="video-tile-name">
                  {user?.username} (you){muted && " 🔇"}{screenSharing && " 🖥️"}
                </div>
              </div>

              {participants.map((p) => {
                const isSpeaking = !!speakingMap[p.socketId];
                return (
                  <div
                    key={p.socketId}
                    className={`video-tile ${isSpeaking ? "speaking" : ""}`}
                  >
                    {p.stream ? (
                      <video
                        ref={getVideoRefCallback(p.socketId)}
                        autoPlay
                        playsInline
                      />
                    ) : (
                      <div className="video-avatar">
                        {p.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="video-tile-name">
                      {p.username}{remoteSharing[p.socketId] && " 🖥️"}
                    </div>
                  </div>
                );
              })}
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
                disabled={screenSharing}
              >
                {videoOff ? "📵" : "📹"}
                <span>{videoOff ? "Start Video" : "Stop Video"}</span>
              </button>
              <button
                className={`call-ctrl-btn ${screenSharing ? "active" : ""}`}
                onClick={toggleScreenShare}
              >
                🖥️
                <span>{screenSharing ? "Stop Sharing" : "Share Screen"}</span>
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