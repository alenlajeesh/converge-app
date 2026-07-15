import { useEffect, useRef, useState, useCallback } from "react";
import { useSpeakingDetection } from "../hooks/useSpeakingDetection";
import "../styles/callview.css";

export default function CallView({ socket, workspaceId, user }) {
  const [participants, setParticipants] = useState([]);
  const [inCall,       setInCall]       = useState(false);
  const [muted,        setMuted]        = useState(false);
  const [connecting,   setConnecting]   = useState(false);
  const [error,        setError]        = useState("");

  // 🖥️ screen share state
  const [screenSharing,       setScreenSharing]       = useState(false);
  const [screenShareStreams,  setScreenShareStreams]  = useState({}); // { socketId: MediaStream }

  const localStreamRef = useRef(null);
  const peersRef       = useRef({});
  const audioRefs      = useRef({});
  const pendingCandidatesRef = useRef({});

  // 🖥️ screen share refs
  const screenStreamRef        = useRef(null);
  const localScreenVideoRef    = useRef(null);
  const screenVideoRefs        = useRef({});
  const screenVideoRefCallbacksRef = useRef({});

  const { speakingMap, startMonitor, stopMonitor, stopAll } = useSpeakingDetection(18);

  const cleanupPeer = useCallback((socketId) => {
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].destroy();
      delete peersRef.current[socketId];
    }
    if (audioRefs.current[socketId]) {
      audioRefs.current[socketId].srcObject = null;
      delete audioRefs.current[socketId];
    }
    delete pendingCandidatesRef.current[socketId];
    delete screenVideoRefs.current[socketId];
    delete screenVideoRefCallbacksRef.current[socketId];
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
        socket.emit("call-offer", { targetSocketId, offer: signalData, callType: "audio" });
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

    // 🖥️ A screen-share track arrives as its OWN MediaStream (video-only,
    // no audio) since we add it via addTrack(track, newStream) rather
    // than mixing it into the original audio call stream. We branch on
    // track kind so the original audio-call path below is completely
    // untouched by screen sharing.
    peer.on("stream", (remoteStream) => {
      const hasAudio = remoteStream.getAudioTracks().length > 0;
      const hasVideo = remoteStream.getVideoTracks().length > 0;

      console.log(`🎧 STREAM RECEIVED <- ${targetSocketId}`, remoteStream.getTracks().map(t => `${t.kind}:${t.readyState}`));

      if (hasAudio) {
        let audio = audioRefs.current[targetSocketId];
        if (!audio) {
          audio = new Audio();
          audioRefs.current[targetSocketId] = audio;
        }
        audio.srcObject = remoteStream;
        audio.play().catch(console.error);
        startMonitor(targetSocketId, remoteStream);
      }

      if (hasVideo) {
        setScreenShareStreams((prev) => ({ ...prev, [targetSocketId]: remoteStream }));
      }
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

    const onUserJoined = ({ socketId, username, callType }) => {
      if (!localStreamRef.current) return;
      setParticipants((prev) => {
        if (prev.find((p) => p.socketId === socketId)) return prev;
        return [...prev, { socketId, username, callType }];
      });
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
      setScreenShareStreams((prev) => {
        if (!prev[socketId]) return prev;
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    const onCallEnded = () => leaveCall(false);

    // 🖥️ screen-share-stop is our signal to clear a stale tile — the
    // renegotiated track removal doesn't reliably fire a UI-visible
    // event on its own, so we rely on this explicit message instead.
    const onScreenShareStop = ({ socketId }) => {
      setScreenShareStreams((prev) => {
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
    socket.on("screen-share-stop",        onScreenShareStop);

    return () => {
      socket.off("call-user-joined",          onUserJoined);
      socket.off("call-existing-participants", onExistingParticipants);
      socket.off("call-offer",                onOffer);
      socket.off("call-answer",               onAnswer);
      socket.off("call-ice-candidate",        onIceCandidate);
      socket.off("call-user-left",            onUserLeft);
      socket.off("call-ended",               onCallEnded);
      socket.off("screen-share-stop",        onScreenShareStop);
    };
  }, [socket, createPeer, cleanupPeer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable ref-callback per remote sharer, same pattern used in VideoView
  // to avoid re-triggering srcObject assignment on unrelated re-renders.
  const getScreenVideoRefCallback = useCallback((socketId) => {
    if (!screenVideoRefCallbacksRef.current[socketId]) {
      screenVideoRefCallbacksRef.current[socketId] = (el) => {
        if (el) {
          screenVideoRefs.current[socketId] = el;
          if (screenShareStreams[socketId]) {
            el.srcObject = screenShareStreams[socketId];
          }
        } else {
          delete screenVideoRefs.current[socketId];
        }
      };
    }
    return screenVideoRefCallbacksRef.current[socketId];
  }, [screenShareStreams]);

  useEffect(() => {
    Object.entries(screenShareStreams).forEach(([socketId, stream]) => {
      if (screenVideoRefs.current[socketId]) {
        screenVideoRefs.current[socketId].srcObject = stream;
      }
    });
  }, [screenShareStreams]);

  useEffect(() => {
    if (screenSharing && localScreenVideoRef.current && screenStreamRef.current) {
      localScreenVideoRef.current.srcObject = screenStreamRef.current;
    }
  }, [screenSharing]);

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
      startMonitor("self", stream);
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

  // 🖥️ ── SCREEN SHARE ──────────────────────────────────────
  // Unlike VideoView (which replaces an existing video track), this
  // call has no video track to replace — so we ADD one via
  // peer.addTrack(). That triggers a one-time renegotiation per peer,
  // which flows through the exact same call-offer/call-answer/
  // call-ice-candidate handlers already wired up above. The original
  // audio track/connection is never touched.

  const startScreenShare = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setError("Screen sharing isn't supported in this app build.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      const track = stream.getVideoTracks()[0];
      if (!track) return;

      screenStreamRef.current = stream;

      Object.values(peersRef.current).forEach((peer) => {
        try {
          if (typeof peer.addTrack === "function") {
            peer.addTrack(track, stream);
          } else {
            console.warn("This simple-peer version doesn't support addTrack — screen share skipped for a peer.");
          }
        } catch (err) {
          console.error("addTrack failed for a peer (non-fatal):", err);
        }
      });

      setScreenSharing(true);
      socket.emit("screen-share-start", { workspaceId });

      // Handle the browser/OS native "Stop sharing" bar too.
      track.onended = () => stopScreenShare();
    } catch (err) {
      console.error("Screen share error:", err);
      if (err.name !== "NotAllowedError") {
        setError("Could not start screen share.");
      }
    }
  };

  const stopScreenShare = () => {
    if (!screenStreamRef.current) return;
    const track = screenStreamRef.current.getVideoTracks()[0];

    Object.values(peersRef.current).forEach((peer) => {
      try {
        if (track && typeof peer.removeTrack === "function") {
          peer.removeTrack(track, screenStreamRef.current);
        }
      } catch (err) {
        console.error("removeTrack failed for a peer (non-fatal):", err);
      }
    });

    screenStreamRef.current.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenSharing(false);
    socket.emit("screen-share-stop", { workspaceId });
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
    Object.keys(peersRef.current).forEach(cleanupPeer);
    peersRef.current = {};
    stopAll();
    setInCall(false);
    setParticipants([]);
    setMuted(false);
    setScreenShareStreams({});
    if (notify && socket) socket.emit("call-leave", { workspaceId });
  }, [socket, workspaceId, cleanupPeer, stopAll]);

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMuted(!track.enabled); }
  };

  useEffect(() => { return () => leaveCall(true); }, [leaveCall]);

  const selfSpeaking = !!speakingMap.self && !muted;
  const hasAnyScreenShare = screenSharing || Object.keys(screenShareStreams).length > 0;

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
            {/* 🖥️ Screen share tiles — only rendered when someone is
                actually sharing. The rest of the audio-only UI below is
                completely unchanged. */}
            {hasAnyScreenShare && (
              <div className="screen-share-panel">
                {screenSharing && (
                  <div className="screen-share-tile">
                    <video ref={localScreenVideoRef} autoPlay muted playsInline />
                    <div className="screen-share-label">You are sharing 🖥️</div>
                  </div>
                )}
                {Object.keys(screenShareStreams).map((socketId) => {
                  const p = participants.find((pt) => pt.socketId === socketId);
                  return (
                    <div key={socketId} className="screen-share-tile">
                      <video ref={getScreenVideoRefCallback(socketId)} autoPlay playsInline />
                      <div className="screen-share-label">
                        {p?.username || "Someone"} is sharing 🖥️
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="call-participants">
              <div className="call-participant self">
                <div className={`call-avatar ${muted ? "muted" : "active"} ${selfSpeaking ? "speaking" : ""}`}>
                  {user?.username?.[0]?.toUpperCase()}
                </div>
                <span className="call-participant-name">
                  {user?.username} (you){screenSharing && " 🖥️"}
                </span>
                <span className="call-participant-status">
                  {muted ? "🔇" : "🎙️"}
                </span>
              </div>

              {participants.map((p) => {
                const isSpeaking = !!speakingMap[p.socketId];
                return (
                  <div key={p.socketId} className="call-participant">
                    <div className={`call-avatar active ${isSpeaking ? "speaking" : ""}`}>
                      {p.username?.[0]?.toUpperCase()}
                    </div>
                    <span className="call-participant-name">
                      {p.username}{screenShareStreams[p.socketId] && " 🖥️"}
                    </span>
                    <span className="call-participant-status">🎙️</span>
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