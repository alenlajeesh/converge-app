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

  // 🖥️ screen share state — camera and screen are independent tracks/
  // streams, never swapped. remoteScreenStreams holds the actual
  // MediaStream per remote presenter (not a boolean), so multiple
  // simultaneous sharers can each get their own tile.
  const [screenSharing,       setScreenSharing]       = useState(false);
  const [remoteScreenStreams, setRemoteScreenStreams] = useState({}); // { socketId: MediaStream }

  // 📌 pin state — "self" | a participant socketId | null
  const [pinnedId, setPinnedId] = useState(null);

  const localStreamRef  = useRef(null); // camera + mic, ALWAYS stays intact
  const localVideoRef   = useRef(null);
  const selfScreenVideoRef = useRef(null); // local preview of our own screen share
  const peersRef        = useRef({});
  const videoRefs        = useRef({});
  const videoRefCallbacksRef = useRef({});
  const screenVideoRefs        = useRef({});
  const screenVideoRefCallbacksRef = useRef({});
  const pendingCandidatesRef = useRef({});
  const participantsRef = useRef([]); // mirrors `participants` for use inside stable ref callbacks
  const remoteScreenStreamsRef = useRef({}); // mirrors remoteScreenStreams for the same reason

  // 🖥️ screen share refs
  const screenStreamRef = useRef(null);

  const { speakingMap, startMonitor, stopMonitor, stopAll } = useSpeakingDetection(18);

  const cleanupPeer = useCallback((socketId) => {
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].destroy();
      delete peersRef.current[socketId];
    }
    delete videoRefs.current[socketId];
    delete videoRefCallbacksRef.current[socketId];
    delete screenVideoRefs.current[socketId];
    delete screenVideoRefCallbacksRef.current[socketId];
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

      // If we're already screen sharing when this peer connects (e.g. we
      // started sharing, THEN someone new joined), give them the screen
      // track too. Doing it on "connect" rather than right after peer
      // creation avoids racing the initial offer/answer.
      if (screenStreamRef.current) {
        const track = screenStreamRef.current.getVideoTracks()[0];
        if (track) {
          try {
            peer.addTrack(track, screenStreamRef.current);
          } catch (err) {
            console.error("Failed to add screen track to late peer:", err);
          }
        }
      }
    });

    if (peer._pc) {
      peer._pc.oniceconnectionstatechange = () => {
        console.log(`🧊 ICE state (${targetSocketId}):`, peer._pc.iceConnectionState);
      };
      peer._pc.onconnectionstatechange = () => {
        console.log(`🔗 Connection state (${targetSocketId}):`, peer._pc.connectionState);
      };
    }

    // 🖥️ A peer can emit "stream" TWICE — once for the camera+mic stream,
    // once for a screen-share stream, since they're separate MediaStream
    // objects added via addTrack(track, stream). We tell them apart by
    // whether the stream carries an audio track: only the camera stream
    // does (screen share is video-only in this app).
    peer.on("stream", (remoteStream) => {
      const isScreen = remoteStream.getAudioTracks().length === 0;

      console.log(
        `🎥 STREAM RECEIVED <- ${targetSocketId} [${isScreen ? "screen" : "camera"}]`,
        remoteStream.getTracks().map(t => `${t.kind}:${t.readyState}`)
      );

      if (isScreen) {
        setRemoteScreenStreams((prev) => ({ ...prev, [targetSocketId]: remoteStream }));
        if (screenVideoRefs.current[targetSocketId]) {
          screenVideoRefs.current[targetSocketId].srcObject = remoteStream;
        }
      } else {
        setParticipants((prev) =>
          prev.map((p) =>
            p.socketId === targetSocketId ? { ...p, stream: remoteStream } : p
          )
        );
        startMonitor(targetSocketId, remoteStream);
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
      setRemoteScreenStreams((prev) => {
        if (!prev[socketId]) return prev;
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
      // 📌 clear a stale pin if the pinned person just left
      setPinnedId((prev) => (prev === socketId ? null : prev));
    };

    const onCallEnded = () => leaveCall(false);

    // 🖥️ Presence flag isn't needed — the actual MediaStream arrives via
    // the peer's "stream" event above. "stop" removes the tile even if
    // the underlying track hasn't finished tearing down yet.
    const onScreenShareStart = () => {
      // no-op, kept for symmetry / possible future "presenting..." badge
    };
    const onScreenShareStop = ({ socketId }) => {
      setRemoteScreenStreams((prev) => {
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
          const p = participantsRef.current.find((pp) => pp.socketId === socketId);
          if (p?.stream) el.srcObject = p.stream;
        } else {
          delete videoRefs.current[socketId];
        }
      };
    }
    return videoRefCallbacksRef.current[socketId];
  }, []);

  // 🖥️ Same remount-safe pattern as getVideoRefCallback, for remote
  // screen-share tiles (which mount/unmount as spotlight target changes).
  const getScreenVideoRefCallback = useCallback((socketId) => {
    if (!screenVideoRefCallbacksRef.current[socketId]) {
      screenVideoRefCallbacksRef.current[socketId] = (el) => {
        if (el) {
          screenVideoRefs.current[socketId] = el;
          const stream = remoteScreenStreamsRef.current[socketId];
          if (stream) el.srcObject = stream;
        } else {
          delete screenVideoRefs.current[socketId];
        }
      };
    }
    return screenVideoRefCallbacksRef.current[socketId];
  }, []);

  useEffect(() => {
    participantsRef.current = participants;
    participants.forEach((p) => {
      if (p.stream && videoRefs.current[p.socketId]) {
        videoRefs.current[p.socketId].srcObject = p.stream;
      }
    });
  }, [participants]);

  useEffect(() => {
    remoteScreenStreamsRef.current = remoteScreenStreams;
    Object.entries(remoteScreenStreams).forEach(([socketId, stream]) => {
      if (screenVideoRefs.current[socketId]) {
        screenVideoRefs.current[socketId].srcObject = stream;
      }
    });
  }, [remoteScreenStreams]);

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

  // 🖥️ ── SCREEN SHARE (Meet-style: additive, not a swap) ──────────
  // The screen track travels as its own MediaStream, added to each peer
  // via addTrack(track, screenStream). localStreamRef (camera+mic) is
  // NEVER touched, so the camera keeps flowing the whole time — that's
  // what lets your own small self-camera tile stay visible while you
  // present, matching Meet.

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

      screenStreamRef.current = screenStream;

      Object.values(peersRef.current).forEach((peer) => {
        try {
          peer.addTrack(screenTrack, screenStream);
        } catch (err) {
          console.error("addTrack (screen) failed for a peer (non-fatal):", err);
        }
      });

      if (selfScreenVideoRef.current) {
        selfScreenVideoRef.current.srcObject = screenStream;
      }

      setScreenSharing(true);
      socket.emit("screen-share-start", { workspaceId });

      // Browser/OS "Stop sharing" bar
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

    Object.values(peersRef.current).forEach((peer) => {
      try {
        if (screenTrack) peer.removeTrack(screenTrack, screenStreamRef.current);
      } catch (err) {
        console.error("removeTrack (screen) failed for a peer (non-fatal):", err);
      }
    });

    if (selfScreenVideoRef.current) {
      selfScreenVideoRef.current.srcObject = null;
    }

    if (screenTrack) screenTrack.stop();
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
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
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (selfScreenVideoRef.current) selfScreenVideoRef.current.srcObject = null;
    Object.keys(peersRef.current).forEach(cleanupPeer);
    peersRef.current = {};
    stopAll();
    setInCall(false);
    setParticipants([]);
    setMuted(false);
    setVideoOff(false);
    setRemoteScreenStreams({});
    setPinnedId(null);
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

  const setLocalVideoRef = useCallback((el) => {
    localVideoRef.current = el;
    if (el && localStreamRef.current) {
      el.srcObject = localStreamRef.current;
    }
  }, []);

  const setSelfScreenVideoRef = useCallback((el) => {
    selfScreenVideoRef.current = el;
    if (el && screenStreamRef.current) {
      el.srcObject = screenStreamRef.current;
    }
  }, []);

  // 📌 toggle pin — clicking an already-pinned tile unpins it
  const togglePin = useCallback((id) => {
    setPinnedId((prev) => (prev === id ? null : id));
  }, []);

  const selfSpeaking = !!speakingMap.self && !muted;

  const remoteSharerIds = Object.keys(remoteScreenStreams);

  // 📌 Pin wins if the pinned target is still in the call. A pin shows
  // that person's CAMERA (not necessarily a screen) — this is different
  // from the auto screen-share spotlight below.
  const pinnedStillHere =
    pinnedId != null &&
    (pinnedId === "self" || participants.some((p) => p.socketId === pinnedId));

  // Spotlight resolution order: pin > local screen share > first remote
  // screen share > nothing (plain grid).
  const spotlightMode = pinnedStillHere
    ? "pin"
    : screenSharing
    ? "self-screen"
    : remoteSharerIds.length > 0
    ? "remote-screen"
    : null;

  const primarySharerId = spotlightMode === "remote-screen" ? remoteSharerIds[0] : null;

  const renderSelfTile = (small = false) => (
    <div
      className={`video-tile self ${selfSpeaking ? "speaking" : ""} ${pinnedId === "self" ? "pinned" : ""}`}
      onClick={() => togglePin("self")}
    >
      <video
        ref={setLocalVideoRef}
        autoPlay
        muted
        playsInline
        className={videoOff ? "video-off" : ""}
      />
      {videoOff && (
        <div className={`video-avatar ${small ? "video-avatar-sm" : ""}`}>
          {user?.username?.[0]?.toUpperCase()}
        </div>
      )}
      <div className="video-tile-name">
        {user?.username} (you){muted && " 🔇"}
      </div>
      {pinnedId === "self" && <span className="pin-badge">📌</span>}
    </div>
  );

  const renderSelfScreenTile = () => (
    <div className="video-tile self-screen">
      <video ref={setSelfScreenVideoRef} autoPlay muted playsInline />
      <div className="video-tile-name">{user?.username} 🖥️ (your screen)</div>
    </div>
  );

  const renderRemoteScreenTile = (socketId, username) => (
    <div key={`${socketId}-screen`} className="video-tile remote-screen">
      <video ref={getScreenVideoRefCallback(socketId)} autoPlay playsInline />
      <div className="video-tile-name">{username} 🖥️</div>
    </div>
  );

  const renderParticipantTile = (p, small = false) => {
    const isSpeaking = !!speakingMap[p.socketId];
    const isPinned = pinnedId === p.socketId;
    return (
      <div
        key={p.socketId}
        className={`video-tile ${isSpeaking ? "speaking" : ""} ${isPinned ? "pinned" : ""}`}
        onClick={() => togglePin(p.socketId)}
      >
        {p.stream ? (
          <video
            ref={getVideoRefCallback(p.socketId)}
            autoPlay
            playsInline
          />
        ) : (
          <div className={`video-avatar ${small ? "video-avatar-sm" : ""}`}>
            {p.username?.[0]?.toUpperCase()}
          </div>
        )}
        <div className="video-tile-name">
          {p.username}{remoteScreenStreams[p.socketId] && " 🖥️"}
        </div>
        {isPinned && <span className="pin-badge">📌</span>}
      </div>
    );
  };

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
            {spotlightMode ? (
              <div className="meet-stage">
                <div className="meet-spotlight">
                  {spotlightMode === "pin" && pinnedId === "self" && renderSelfTile(false)}
                  {spotlightMode === "pin" && pinnedId !== "self" &&
                    renderParticipantTile(
                      participants.find((p) => p.socketId === pinnedId),
                      false
                    )}
                  {spotlightMode === "self-screen" && renderSelfScreenTile()}
                  {spotlightMode === "remote-screen" &&
                    renderRemoteScreenTile(
                      primarySharerId,
                      participants.find((p) => p.socketId === primarySharerId)?.username
                    )}
                </div>

                <div className="meet-filmstrip">
                  {/* Self camera ALWAYS shows here, unless self is the
                      one currently pinned into the spotlight above. */}
                  {!(spotlightMode === "pin" && pinnedId === "self") && renderSelfTile(true)}

                  {/* Any active screen share NOT currently in the
                      spotlight still gets its own tile — fixes the case
                      where two people share at once, or someone shares
                      while a different person is pinned. */}
                  {remoteSharerIds
                    .filter((id) => id !== primarySharerId)
                    .map((id) =>
                      renderRemoteScreenTile(id, participants.find((p) => p.socketId === id)?.username)
                    )}

                  {participants
                    .filter((p) => !(spotlightMode === "pin" && p.socketId === pinnedId))
                    .map((p) => renderParticipantTile(p, true))}
                </div>
              </div>
            ) : (
              <div className={`video-grid participants-${participants.length + 1}`}>
                {renderSelfTile(false)}
                {participants.map((p) => renderParticipantTile(p, false))}
              </div>
            )}

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
                className={`call-ctrl-btn ${screenSharing ? "active" : ""}`}
                onClick={toggleScreenShare}
              >
                🖥️
                <span>{screenSharing ? "Stop Sharing" : "Share Screen"}</span>
              </button>
              {pinnedId && (
                <button
                  className="call-ctrl-btn"
                  onClick={() => setPinnedId(null)}
                >
                  📌
                  <span>Unpin</span>
                </button>
              )}
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