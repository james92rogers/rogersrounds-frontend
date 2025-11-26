import React from "react";

export default function Timer({ secondsLeft, big = false }) {
  if (secondsLeft === null || secondsLeft === undefined) return <div />;
  const s = Math.max(0, secondsLeft);
  const style = { fontSize: big ? 48 : 18, marginTop: 8 };
  return <div style={style}>Time left: {s}s</div>;
}
