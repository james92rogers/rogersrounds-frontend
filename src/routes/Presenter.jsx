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
      setSequenceSteps([]);
      // Only show tick if MC question
      setTick(
        question.type === "mc" && endsAt
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
      // Make sure ALL players appear even if they have 0 points.
      const leaderboard = (pList || players)
        .map((p) => ({
          sid: p.sid,
          name: p.name,
          pts: Number(roundScores?.[p.sid] || 0),
        }))
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
      setTick(null);
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

    return (
      <div>
        {currentQuestion?.type === "sequence" ||
        currentQuestion?.type === "link" ? (
          <div style={{ marginTop: 12 }}>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                display: "flex",
                justifyContent: "start",
                gap: "20px",
                width: "1260px",
                margin: "0 auto",
                marginBottom: "30px",
              }}
            >
              {sequenceSteps.map((s, i) => (
                <li
                  key={i}
                  style={{
                    margin: "6px 0",
                    height: "300px",
                    width: "300px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid white",
                    borderRadius: "8px",
                    padding: "10px",
                  }}
                >
                  {s.text && (
                    <p style={{ fontSize: "20px", fontWeight: "700" }}>
                      {s.text}
                    </p>
                  )}
                  {s.image && (
                    <img
                      src={`https://rogersrounds-server.onrender.com${s.image}`}
                      alt={`Step ${i + 1}`}
                      style={{
                        width: "290px",
                        height: "290px",
                        display: "block",
                        marginTop: 6,
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>

            {answerRevealed && (
              <div
                style={{ marginTop: 12, fontSize: "1.4rem", color: "#00C2A8" }}
              >
                {titleRevealed}
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 className="text-3xl mb-2">{currentQuestion.question}</h2>
            <div
              style={{
                borderBottom: "1px solid white",
                width: "100%",
                marginBottom: 10,
              }}
            />
          </>
        )}

        {isMC && currentQuestion.choices && (
          <ul style={{ listStyle: "none", padding: 0, marginBottom: 20 }}>
            {currentQuestion.choices.map((c, i) => (
              <li
                key={i}
                style={{
                  margin: "8px 0",
                  fontSize: "1.6rem",
                  color:
                    answerRevealed != null
                      ? String(c) === String(answerRevealed)
                        ? "#00C2A8"
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
          <div style={{ marginTop: 10, fontSize: "1.4rem", color: "#00C2A8" }}>
            {buzzedPlayer} has buzzed in!
          </div>
        )}

        {!isMC && answerRevealed && (
          <div style={{ marginTop: 12, fontSize: "1.4rem", color: "#00C2A8" }}>
            Answer: {answerRevealed}
          </div>
        )}

        <h3>{isMC ? tick !== null : ""}</h3>

        {isMC ? (
          <div style={{ marginTop: 20 }}>
            <h4>Players submitted:</h4>
            <ul className="flex gap-5 justify-center mt-2">
              {players.map((p) => (
                <li key={p.sid}>
                  {p.name} {submitted[p.sid] ? "✅" : "❌"}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div style={{ marginTop: 20 }}>
            <h4>Players Status:</h4>
            <ul className="flex gap-5 justify-center mt-2">
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
      <h2 className="text-3xl font-bold mb-5">Round Leaderboard</h2>

      <ul className="space-y-2 flex flex-col items-center">
        {roundLeaderboard.map((row, index) => (
          <li
            key={row.sid}
            className={`
            flex justify-between items-center p-3 rounded-lg w-120
            ${index === 0 ? "font-extrabold text-yellow-500" : "text-white"}
          `}
          >
            <span className="text-xl">{row.name}</span>
            <span className="text-xl">{row.pts}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const renderTotalLeaderboard = () => {
    const sorted = players
      .slice()
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    return (
      <div>
        <h2 className="text-3xl font-bold mb-5">Total Leaderboard</h2>

        <ul className="space-y-2 flex flex-col items-center">
          {sorted.map((p, index) => (
            <li
              key={p.sid}
              className={`
              flex justify-between items-center p-3 rounded-lg w-120
              ${index === 0 ? "font-extrabold text-yellow-500" : "text-white"}
            `}
            >
              <span className="text-xl">{p.name}</span>
              <span className="text-xl">{p.score ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div
      style={{
        padding: 20,
        background: "#0b1b3a",
        color: "#fff",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ textAlign: "center", fontSize: "25px" }}>Rogers Rounds</h1>
      <div style={{ marginTop: 40, textAlign: "center" }}>
        {currentQuestion ? (
          renderQuestion()
        ) : showRoundLeaderboard ? (
          renderRoundLeaderboard()
        ) : showTotalLeaderboard ? (
          renderTotalLeaderboard()
        ) : (
          <div className="flex flex-col items-center gap-5">
            <img
              src="/images/rogersroundslogo2.png"
              alt="Rogers Rounds Logo"
              style={{ width: 200 }}
            />
            <h2>Waiting for next question…</h2>
          </div>
        )}
      </div>
    </div>
  );
}
