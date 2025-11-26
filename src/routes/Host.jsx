// web/src/routes/Host.jsx
import React, { useEffect, useState } from "react";
import { socket } from "../socket";
import Timer from "../components/Timer";

export default function Host() {
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [round, setRound] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [tick, setTick] = useState(null);
  const [roundType, setRoundType] = useState("mc");
  const [roundCount, setRoundCount] = useState(1);
  const [loadedQuestions, setLoadedQuestions] = useState([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [scoreOverrides, setScoreOverrides] = useState({});
  const [roundFinished, setRoundFinished] = useState(false);
  const [postRoundMode, setPostRoundMode] = useState(false);
  const [allAnswered, setAllAnswered] = useState(false);
  const [revealError, setRevealError] = useState("");
  const [sequenceSteps, setSequenceSteps] = useState([]); // revealed steps

  // ---------- Socket events ----------
  useEffect(() => {
    socket.on("players", setPlayers);

    socket.on("roundStarted", ({ round }) => {
      setRound(round);
      setTick(Math.max(0, Math.round((round.endsAt - Date.now()) / 1000)));
      setShowAnswer(false);
      setScoreOverrides({});
      setPostRoundMode(false);
      setRoundFinished(false);
      setAllAnswered(false);
    });

    socket.on("questionStarted", ({ question, endsAt }) => {
      setCurrentQuestion(question);
      setTick(
        endsAt ? Math.max(0, Math.round((endsAt - Date.now()) / 1000)) : null
      );
      setShowAnswer(false);
      setScoreOverrides({});
      setAllAnswered(false);
      setRevealError("");
    });

    socket.on("tick", ({ remaining }) => {
      if (!allAnswered) setTick(remaining);
    });

    socket.on("allAnswered", () => {
      setAllAnswered(true);
      setTick(0);
    });

    socket.on("answerRevealed", ({ answer, defaultQuestionScores }) => {
      setScoreOverrides(defaultQuestionScores || {});
      setShowAnswer(true);
    });

    socket.on("scoreUpdate", (playersList) => setPlayers(playersList || []));

    socket.on("roundLeaderboard", ({ players: p }) => {
      setPlayers(p || []);
      setPostRoundMode(true);
      setRoundFinished(false);
      setShowAnswer(false);
      setCurrentQuestion(null);
    });

    socket.on("finalScoreboard", ({ players: final }) => {
      setPlayers(final || []);
      setPostRoundMode(false);
      setRoundFinished(false);
      setCurrentQuestion(null);
      setShowAnswer(false);
      setRound(null);
    });

    socket.on("buzzed", (bz) => {
      console.log("Buzzed:", bz);
    });

    socket.on("buzzerReset", () => {
      console.log("Buzzer reset");
    });

    socket.on("hostBuzzerQuestionStarted", ({ question }) => {
      // `question` contains correctAnswer (private) — merge into currentQuestion
      setCurrentQuestion((prev) => ({ ...(prev || {}), ...question }));
      // ensure tick stops/cleared locally
      setTick(null);
      setShowAnswer(false);
      setScoreOverrides({});
    });

    socket.on("sequenceStarted", ({ question, visibleSteps }) => {
      setCurrentQuestion(question);
      setSequenceSteps(visibleSteps || []);
      setShowAnswer(false);
      setScoreOverrides({});
      setAllAnswered(false);
      setRevealError("");
    });

    return () => socket.off();
  }, [allAnswered]);

  // ---------- Host actions ----------
  const createRoom = () => {
    socket.emit("createRoom", (res) => {
      if (res.ok) {
        setRoom(res.room);
        socket.emit(
          "joinRoom",
          { room: res.room, name: "HOST", role: "host" },
          () => {}
        );
      }
    });
  };

  const loadQuestions = () => {
    if (!room) return alert("Create a room first");
    socket.emit(
      "getQuestions",
      { type: roundType, count: roundCount },
      (res) => {
        if (res.ok) setLoadedQuestions(res.questions || []);
      }
    );
  };

  const startRound = () => {
    socket.emit("startRound", { roundType }, (res) => {
      if (res.ok) startNextQuestion();
    });
  };

  const startNextQuestion = () => {
    if (!loadedQuestions.length) return alert("No questions loaded");

    const [nextQ, ...rest] = loadedQuestions;
    setLoadedQuestions(rest);
    setCurrentQuestion(nextQ);
    setShowAnswer(false);
    setScoreOverrides({});
    setAllAnswered(false);
    setRevealError("");

    socket.emit("startQuestion", { question: nextQ });
  };

  const revealAnswer = () => {
    if (!currentQuestion) return;

    socket.emit("revealAnswer", {}, (res) => {
      if (res.ok) setShowAnswer(true);
      else if (res.reason === "early")
        setRevealError(
          "Can't reveal answer until all players have answered or time expired."
        );
    });
  };

  const confirmScores = () => {
    socket.emit("confirmPoints", scoreOverrides, (res) => {
      if (res.ok) {
        setScoreOverrides({});
        setShowAnswer(false);
        setCurrentQuestion(null);
        setAllAnswered(false);

        if (!loadedQuestions.length) setRoundFinished(true);
      }
    });
  };

  const endRound = () => {
    socket.emit("endRound", {}, (res) => {
      if (res.ok) setPostRoundMode(true);
    });
  };

  const showFullLeaderboard = () => socket.emit("showFullLeaderboard", {});
  const endShow = () => socket.emit("endShow", {});
  const resetBuzzer = () => socket.emit("resetBuzzer", {});
  const lockoutLastBuzzer = () => socket.emit("resetBuzzer", { all: false });
  const dontLockoutLastBuzzer = () =>
    socket.emit("resetBuzzer", { all: false, preserveLocks: true });

  const revealNextStep = () => {
    socket.emit("revealNextStep", {}, (res) => {
      if (res.ok) {
        setSequenceSteps((prev) => [
          ...prev,
          currentQuestion.steps[res.revealedStepIndex],
        ]);
      }
    });
  };

  const revealSequenceAnswer = () => {
    socket.emit("revealSequenceAnswer", {}, (res) => {
      if (res.ok) setShowAnswer(true);
    });
  };

  const hasPlayers = room && players.length > 0;

  // ---------- Render ----------
  return (
    <div style={{ padding: 20 }}>
      <h2>Host</h2>
      <div>
        <button onClick={createRoom}>Create Room</button>
        <span style={{ marginLeft: 10 }}>
          {room ? `Room: ${room}` : "No room"}
        </span>
      </div>

      {hasPlayers && (
        <>
          <div style={{ marginTop: 12 }}>
            <label>
              Round type:{" "}
              <select
                value={roundType}
                onChange={(e) => setRoundType(e.target.value)}
              >
                <option value="mc">MC Round</option>
                <option value="buzzer">Buzzer Round</option>
                <option value="sequence">Sequence Round</option>
              </select>
            </label>

            <label style={{ marginLeft: 10 }}>
              Number of questions:{" "}
              <input
                type="number"
                min={1}
                max={50}
                value={roundCount}
                onChange={(e) => setRoundCount(Number(e.target.value))}
              />
            </label>

            <button style={{ marginLeft: 10 }} onClick={loadQuestions}>
              Load Questions
            </button>

            {loadedQuestions.length > 0 && !round && (
              <button style={{ marginLeft: 10 }} onClick={startRound}>
                Start Round
              </button>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            {!currentQuestion &&
              loadedQuestions.length > 0 &&
              round &&
              !postRoundMode && (
                <button onClick={startNextQuestion}>Start Next Question</button>
              )}

            {currentQuestion && !showAnswer && (
              <button
                onClick={revealAnswer}
                disabled={
                  currentQuestion?.buzzer ? false : !allAnswered && tick > 0
                }
                style={{
                  opacity: currentQuestion?.buzzer
                    ? 1
                    : !allAnswered && tick > 0
                    ? 0.5
                    : 1,
                  cursor: currentQuestion?.buzzer
                    ? "pointer"
                    : !allAnswered && tick > 0
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                Reveal Answer
              </button>
            )}

            {currentQuestion?.type === "sequence" && (
              <div style={{ marginTop: 12 }}>
                <p>
                  Steps revealed: {sequenceSteps.length} /{" "}
                  {currentQuestion.steps.length}
                </p>

                {!showAnswer &&
                  sequenceSteps.length < currentQuestion.steps.length && (
                    <button onClick={revealNextStep}>Reveal Next Step</button>
                  )}

                {!showAnswer && (
                  <button
                    onClick={revealSequenceAnswer}
                    style={{ marginLeft: 8 }}
                  >
                    Reveal Answer
                  </button>
                )}
              </div>
            )}

            {revealError && (
              <div style={{ color: "red", marginTop: 6 }}>{revealError}</div>
            )}

            {showAnswer && currentQuestion && (
              <>
                <div>
                  {players.map((p) => (
                    <div key={p.sid}>
                      {p.name}:
                      <input
                        type="number"
                        step={10}
                        value={scoreOverrides[p.sid] ?? 0}
                        onChange={(e) =>
                          setScoreOverrides((s) => ({
                            ...s,
                            [p.sid]: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <button onClick={confirmScores}>Confirm Scores</button>
              </>
            )}

            {roundFinished && !postRoundMode && (
              <div style={{ marginTop: 12 }}>
                <button onClick={endRound}>End Round</button>
              </div>
            )}

            {postRoundMode && (
              <div style={{ marginTop: 12 }}>
                <button onClick={showFullLeaderboard}>
                  Show Full Leaderboard
                </button>
                <button onClick={endShow} style={{ marginLeft: 8 }}>
                  End Show
                </button>
              </div>
            )}

            {round?.type === "buzzer" ||
              (round?.type === "sequence" && (
                <>
                  <button onClick={resetBuzzer}>Reset Buzzer</button>
                  <button onClick={lockoutLastBuzzer}>Lock Last Buzzer</button>
                  <button onClick={dontLockoutLastBuzzer}>
                    Resume Without Lockout
                  </button>
                </>
              ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 18 }}>
        <h3>Current Question</h3>

        {allAnswered && currentQuestion && (
          <div style={{ marginBottom: 10, color: "green" }}>
            All players have answered.
          </div>
        )}

        {currentQuestion ? (
          <div>
            <div>
              <strong>{currentQuestion.question}</strong>
            </div>
            <div>Type: {currentQuestion.type}</div>
            {currentQuestion.type === "buzzer" && (
              <div>Answer: {currentQuestion.answer}</div>
            )}
            <Timer secondsLeft={tick} />
          </div>
        ) : (
          <div>No active question</div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <h3>Players</h3>
        <ul>
          {players.map((p) => (
            <li key={p.sid}>
              {p.name} — {p.score}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 18 }}>
        {room && (
          <a href={`/presenter?room=${room}`} target="_blank" rel="noopener">
            Open Presenter View
          </a>
        )}
      </div>
    </div>
  );
}
