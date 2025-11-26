// web/src/routes/Play.jsx
import React, { useEffect, useState } from "react";
import { socket } from "../socket";
import Timer from "../components/Timer";

export default function Play() {
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);

  const [round, setRound] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [tick, setTick] = useState(null);
  const [status, setStatus] = useState("");

  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [buzzed, setBuzzed] = useState(false);
  const [buzzLocked, setBuzzLocked] = useState(false);
  const [sequenceSteps, setSequenceSteps] = useState([]);
  const [answer, setAnswer] = useState(null);

  useEffect(() => {
    // Connect / join
    socket.on("roundStarted", ({ round }) => {
      setRound(round);
      if (round?.endsAt)
        setTick(Math.max(0, Math.round((round.endsAt - Date.now()) / 1000)));
      else setTick(null);
      setStatus("Round started");
      setCurrentQuestion(null);
      setSelectedAnswer(null);
      setSubmitted(false);
    });

    socket.on("questionStarted", ({ question, endsAt }) => {
      setCurrentQuestion(question);
      // Only show tick for MC questions
      setTick(
        !question.buzzer && endsAt
          ? Math.max(0, Math.round((endsAt - Date.now()) / 1000))
          : null
      );
      setSelectedAnswer(null);
      setSubmitted(false);
      setStatus("Question started");
      setAnswer(null);
    });

    socket.on("tick", ({ remaining }) => setTick(remaining));

    socket.on("roundEnded", () => {
      setStatus("Round ended");
      setRound(null);
      setCurrentQuestion(null);
      setTick(null);
      setSubmitted(false);
      setBuzzed(false);
      setBuzzLocked(false);
    });

    // Handle buzzes
    socket.on("buzzed", (bz) => {
      if (!buzzed) setBuzzLocked(true);
      setStatus(`Buzzed: ${bz.name}`);
    });

    socket.on("buzzerReset", () => {
      setBuzzLocked(false);
      setBuzzed(false);
      setStatus("Buzzer reset, you can buzz now");
    });

    socket.on("buzzerStatus", ({ disabled }) => {
      setBuzzLocked(disabled);
      if (disabled) setStatus("You are locked out");
    });

    socket.on("sequenceStarted", ({ question, visibleSteps }) => {
      setCurrentQuestion(question);
      setSequenceSteps(visibleSteps || []);
      setSubmitted(false);
      setAnswer(null);
      setBuzzLocked(false);
      setBuzzed(false);
      setStatus("Question started");
    });

    socket.on("sequenceStepRevealed", ({ visibleSteps }) => {
      setSequenceSteps(visibleSteps || []);
    });

    socket.on("sequenceAnswerRevealed", ({ answer }) => {
      setAnswer(answer);
    });

    return () => socket.off();
  }, []);

  const join = () => {
    socket.emit("joinRoom", { room, name }, (res) => {
      if (res.ok) setJoined(true);
      else alert(res.error || "Join failed");
    });
  };

  const submitAnswer = (answer) => {
    if (submitted) return;

    setSelectedAnswer(answer);
    socket.emit("submitAnswer", { answer }, (res) => {
      if (res.ok) {
        setStatus("Answer submitted");
        setSubmitted(true);
      } else {
        setStatus("Failed to submit");
      }
    });
  };

  const buzz = () => {
    if (buzzLocked) return;
    socket.emit("buzz", (res) => {
      if (res.ok) {
        setBuzzed(true);
        setBuzzLocked(true);
        setStatus("You buzzed!");
      } else {
        setStatus(res?.error || "Buzz failed");
      }
    });
  };

  const isMC = currentQuestion?.type === "mc";
  const isBuzzer = currentQuestion?.buzzer;

  return (
    <div style={{ padding: 20 }}>
      <h2>Player</h2>

      {!joined ? (
        <div>
          <input
            placeholder="Room code"
            value={room}
            onChange={(e) => setRoom(e.target.value.toUpperCase())}
          />
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button onClick={join}>Join</button>
        </div>
      ) : (
        <div>
          Joined room {room} as {name}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <strong>Status:</strong> {status}
      </div>

      {currentQuestion && (
        <div style={{ marginTop: 20 }}>
          <h3>{currentQuestion.question}</h3>

          {/* Multiple-choice answers */}
          {isMC && (
            <div>
              {currentQuestion.choices.map((c) => (
                <button
                  key={c}
                  onClick={() => submitAnswer(c)}
                  disabled={submitted}
                  style={{
                    display: "block",
                    margin: "6px 0",
                    padding: "10px",
                    background: selectedAnswer === c ? "#333" : "#555",
                    border:
                      selectedAnswer === c
                        ? "2px solid yellow"
                        : "1px solid #222",
                    color: "white",
                    cursor: submitted ? "default" : "pointer",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Buzzer button */}
          {currentQuestion.type === "buzzer" && (
            <button
              style={{
                marginTop: 12,
                background: buzzLocked ? "#888" : "#ff5555",
                cursor: buzzLocked ? "not-allowed" : "pointer",
                padding: "12px 24px",
                fontSize: "1.2rem",
                color: "#fff",
                border: "none",
                borderRadius: 6,
              }}
              onClick={buzz}
              disabled={buzzLocked}
            >
              Buzz!
            </button>
          )}

          {currentQuestion?.type === "sequence" && (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={buzz}
                disabled={buzzLocked}
                style={{
                  background: buzzLocked ? "#888" : "#ff5555",
                  cursor: buzzLocked ? "not-allowed" : "pointer",
                  padding: "12px 24px",
                  fontSize: "1.2rem",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                }}
              >
                Buzz!
              </button>

              {answer && (
                <div
                  style={{ marginTop: 12, fontSize: "1.4rem", color: "lime" }}
                >
                  Answer: {answer}
                </div>
              )}
            </div>
          )}

          <Timer secondsLeft={tick} show={currentQuestion.type === "mc"} />
        </div>
      )}
    </div>
  );
}
