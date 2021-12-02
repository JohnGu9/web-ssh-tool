import ws from 'ws';
import { Client } from 'ssh2';

import { Context, wsSafeClose } from "./common";

async function terminal(context: Context) {
  const wsServer = new ws.Server({ noServer: true });
  return wsServer.on('connection', (ws: ws, req) => {
    const id = req.headers['sec-websocket-key'];
    const address = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
    context.logger.log(`Client [${id}] (address: ${address}) connect to ssh terminal. `);
    ws.once('message', (data: string) => {
      try {
        const { token, config } = JSON.parse(data);
        if (context.token.verify(token)) {
          const client = new Client();
          client.once('error', () => wsSafeClose(ws));
          ws.once('close', () => {
            client.end();
            client.destroy();
          });
          return client
            .once('ready',
              () => client.shell(
                (error, stream) => {
                  if (error) return wsSafeClose(ws);
                  context.logger.log(`Client [${id}] (address: ${address}) successfully open a ssh channel. `);
                  stream.on('data', (data: any) => ws.send(data.toString('binary')));
                  ws.on('message', (data) => stream.write(data));
                  stream.once('close', () => wsSafeClose(ws));
                  stream.once('error', () => wsSafeClose(ws));
                }))
            .connect({ ...config, host: 'localhost' });
        }
        context.logger.error(`Unknown connection [${address}] try to connect terminal without token`);
      } catch (error) {
        context.logger.error(`Connection [${address}] try to connect terminal but cause error ${error}`);
      }
      wsSafeClose(ws);
    });
    ws.once('error', () => wsSafeClose(ws));
  });
}

export default terminal;
