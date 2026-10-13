// WebSocket relay server for the Assistive Device Controller.
// Deploy this on Render.com (NOT Vercel) - Vercel's serverless
// functions can't keep a persistent WebSocket connection open.
//
// Both the website and the ESP32 connect here as WebSocket clients.
// When either one sends a message, this server updates the shared
// state and instantly broadcasts it to everyone else connected -
// no polling, no delay.

const WebSocket = require('ws');

const PORT = process.env.PORT || 3001;
const wss = new WebSocket.Server({ port: PORT });

let state = { led1: "OFF", led2: "OFF", buzz: "OFF" };

function broadcast() {
  const payload = JSON.stringify(state);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('Client connected. Total clients:', wss.clients.size);

  // Send the current state immediately so a newly connected client
  // (a new website tab, or the ESP32 after a reboot) is instantly
  // in sync without waiting for the next change.
  ws.send(JSON.stringify(state));

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (e) {
      console.log('Could not parse message:', data.toString());
      return;
    }

    if (msg.mode === "READY") {
      state = { led1: "OFF", led2: "ON", buzz: "OFF" };
    } else if (msg.mode === "NEED_HELP") {
      state = { led1: "ON", led2: "OFF", buzz: "OFF" };
    } else if (msg.mode === "EMERGENCY") {
      state = { led1: "ON", led2: "OFF", buzz: "ON" };
    } else if (
      ["led1", "led2", "buzz"].includes(msg.device) &&
      ["ON", "OFF"].includes(msg.state)
    ) {
      state[msg.device] = msg.state;
    } else {
      console.log('Ignored invalid message:', data.toString());
      return;
    }

    broadcast();
  });

  ws.on('close', () => {
    console.log('Client disconnected. Total clients:', wss.clients.size);
  });
});

console.log(`WebSocket relay server running on port ${PORT}`);
