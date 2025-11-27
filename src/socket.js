import { io } from "socket.io-client";

// IMPORTANT: one single global socket instance
export const socket = io("https://rogersrounds-server.onrender.com", {
  transports: ["websocket"], // force websocket for stability
});

// USE FOR LOCAL TESTING ONLY

// // IMPORTANT: one single global socket instance
// export const socket = io("http://localhost:3000", {
//   transports: ["websocket"], // force websocket for stability
// });
