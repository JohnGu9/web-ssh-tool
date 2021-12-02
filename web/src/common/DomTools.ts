export function wsSafeClose(ws: WebSocket) {
  switch (ws.readyState) {
    case WebSocket.CLOSED:
    case WebSocket.CLOSING:
      return;
  }
  ws.close();
}
