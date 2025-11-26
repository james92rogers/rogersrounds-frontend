// web/src/routes/Presenter.jsx
import React, { useState, useEffect } from "react";
import { socket } from "../socket";

export default function Presenter() {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [tick, setTick] = useState(null);
  const [players, setPlayers] = useState([]);
  const [submitted, setSubmitted] = useState({});
  const [lockedOut, setLockedOut] = useState({});
  const [answerRevealed, setAnswerRevealed] = useState(null);
  const [titleRevealed, setTitleRevealed] = useState(null);

  const [roundLeaderboard, setRoundLeaderboard] = useState([]);
  const [showRoundLeaderboard, setShowRoundLeaderboard] = useState(false);
  const [showTotalLeaderboard, setShowTotalLeaderboard] = useState(false);
  const [sequenceSteps, setSequenceSteps] = useState([]);

  const [buzzedPlayer, setBuzzedPlayer] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (!room) return;

    socket.emit("joinRoom", { room, name: "Presenter", role: "presenter" });

    socket.on("players", (p) => setPlayers(p || []));

    // Track submissions
    socket.on("playerAnswered", ({ id, name }) =>
      setSubmitted((prev) => ({ ...prev, [id]: name }))
    );

    // Track buzzer events
    socket.on("buzzed", (bz) => {
      setBuzzedPlayer(bz.name);
    });

    socket.on("buzzerReset", () => setBuzzedPlayer(null));

    socket.on("buzzerLockedOut", ({ sid }) => {
      setLockedOut((prev) => ({ ...prev, [sid]: true }));
    });

    socket.on("questionStarted", ({ question, endsAt }) => {
      setCurrentQuestion(question);
      // Only show tick if MC question
      setTick(
        !question.buzzer && endsAt
          ? Math.max(0, Math.round((endsAt - Date.now()) / 1000))
          : null
      );
      setSubmitted({});
      setAnswerRevealed(null);
      setShowRoundLeaderboard(false);
      setShowTotalLeaderboard(false);
      setBuzzedPlayer(null);
      setLockedOut({});
    });

    socket.on("tick", ({ remaining }) => setTick(remaining));

    socket.on("answerRevealed", ({ answer }) => {
      setAnswerRevealed(answer);
    });

    socket.on("roundLeaderboard", ({ roundScores, players: pList }) => {
      const leaderboard = Object.entries(roundScores || {})
        .map(([sid, pts]) => {
          const name =
            pList?.find((x) => x.sid === sid)?.name ||
            players.find((x) => x.sid === sid)?.name ||
            "Unknown";
          return { sid, name, pts: Number(pts || 0) };
        })
        .sort((a, b) => b.pts - a.pts);

      setRoundLeaderboard(leaderboard);
      setShowRoundLeaderboard(true);
      setShowTotalLeaderboard(false);
      setCurrentQuestion(null);
      setAnswerRevealed(null);
      setBuzzedPlayer(null);
    });

    socket.on("finalScoreboard", ({ players: final = [] }) => {
      setPlayers(final);
      setShowTotalLeaderboard(true);
      setShowRoundLeaderboard(false);
      setRoundLeaderboard([]);
      setCurrentQuestion(null);
      setAnswerRevealed(null);
      setBuzzedPlayer(null);
    });

    socket.on("sequenceStarted", ({ question, visibleSteps }) => {
      setCurrentQuestion(question);
      setSequenceSteps(visibleSteps || []);
      setAnswerRevealed(null);
      setTitleRevealed(null);
      setBuzzedPlayer(null);
      setLockedOut({});
    });

    socket.on("sequenceStepRevealed", ({ step, visibleSteps }) => {
      setSequenceSteps(visibleSteps || []);
    });

    socket.on("sequenceAnswerRevealed", ({ title, answer, steps }) => {
      setAnswerRevealed(answer);
      setTitleRevealed(title);
      setSequenceSteps(steps);
    });

    return () => socket.off();
  }, []);

  const renderQuestion = () => {
    if (!currentQuestion) return null;

    const isMC = currentQuestion.type === "mc";
    const isBuzzer = currentQuestion.buzzer;
    console.log("sequenceSteps", sequenceSteps);

    return (
      <div>
        {currentQuestion?.type === "sequence" ? (
          <div style={{ marginTop: 12 }}>
            <h4>Revealed Steps:</h4>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {sequenceSteps.map((s, i) => (
                <li key={i} style={{ margin: "6px 0" }}>
                  {s.text && <span>{s.text}</span>}
                  {s.image && (
                    <img
                      src={`https://rogersrounds-server.onrender.com${s.image}`}
                      alt={`Step ${i + 1}`}
                      style={{
                        maxWidth: "250px",
                        display: "block",
                        marginTop: 6,
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>

            {answerRevealed && (
              <div style={{ marginTop: 12, fontSize: "1.4rem", color: "lime" }}>
                {titleRevealed}
              </div>
            )}
          </div>
        ) : (
          <h2>{currentQuestion.question}</h2>
        )}

        {isMC && currentQuestion.choices && (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {currentQuestion.choices.map((c, i) => (
              <li
                key={i}
                style={{
                  margin: "8px 0",
                  fontSize: "1.6rem",
                  color:
                    answerRevealed != null
                      ? String(c) === String(answerRevealed)
                        ? "lime"
                        : "#ddd"
                      : "#fff",
                  fontWeight:
                    String(c) === String(answerRevealed) ? "700" : "400",
                  transition: "all .18s ease",
                }}
              >
                {c}
              </li>
            ))}
          </ul>
        )}

        {buzzedPlayer && (
          <div style={{ marginTop: 10, fontSize: "1.4rem", color: "yellow" }}>
            {buzzedPlayer} has buzzed in!
          </div>
        )}

        {!isMC && answerRevealed && (
          <div style={{ marginTop: 12, fontSize: "1.4rem", color: "lime" }}>
            Answer: {answerRevealed}
          </div>
        )}

        <h3>
          {currentQuestion?.buzzer
            ? ""
            : tick !== null
            ? `${tick}s remaining`
            : ""}
        </h3>

        {isMC ? (
          <div style={{ marginTop: 20 }}>
            <h4>Players submitted:</h4>
            <ul>
              {players.map((p) => (
                <li key={p.sid}>
                  {p.name} {submitted[p.sid] ? "✅" : "…"}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div style={{ marginTop: 20 }}>
            <h4>Players Status:</h4>
            <ul>
              {players.map((p) => (
                <li key={p.sid}>
                  {p.name} {lockedOut[p.sid] ? "❌" : "✅"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderRoundLeaderboard = () => (
    <div>
      <h2>Round Leaderboard</h2>
      <ul>
        {roundLeaderboard.map((row) => (
          <li key={row.sid}>
            {row.name} — {row.pts}
          </li>
        ))}
      </ul>
    </div>
  );

  const renderTotalLeaderboard = () => (
    <div>
      <h2>Total Leaderboard</h2>
      <ul>
        {players
          .slice()
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .map((p) => (
            <li key={p.sid}>
              {p.name} — {p.score ?? 0}
            </li>
          ))}
      </ul>
    </div>
  );

  return (
    <div
      style={{
        padding: 20,
        background: "#000",
        color: "#fff",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ textAlign: "center" }}>Presenter View</h1>
      <div style={{ marginTop: 40, textAlign: "center" }}>
        {currentQuestion ? (
          renderQuestion()
        ) : showRoundLeaderboard ? (
          renderRoundLeaderboard()
        ) : showTotalLeaderboard ? (
          renderTotalLeaderboard()
        ) : (
          <h2>Waiting for next question…</h2>
        )}
      </div>
    </div>
  );
}
