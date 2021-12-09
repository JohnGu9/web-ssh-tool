import { Context, wsSafeClose } from "./common";
import ws, { RawData, WebSocket } from 'ws';
import { Client, ClientChannel } from 'ssh2';

async function rest(context: Context) {
  const wsServer = new ws.Server({ noServer: true });
  const { stringify } = JSON;
  return wsServer.on('connection', (ws, req) => {
    const onHangOn = (message: RawData) => {
      const client = new Client();

      client
        .once('error', (error) => {
          client.removeAllListeners();
          client.end();

          // notify sign in failed
          if (ws.readyState === WebSocket.OPEN)
            ws.send(stringify({ error }));
        })
        .once('ready', () => {
          // sign in
          client.removeAllListeners();
          if (ws.readyState !== WebSocket.OPEN) {
            client.end();
            return;
          }

          // clean up while error occur
          const shellMap = new Map<string, ClientChannel>();
          client.once('error', (error) => {
            context.logger.error(`ssh2 error: ${error}`);
            wsSafeClose(ws);
          });
          client.once('close', () => wsSafeClose(ws));
          ws.once('close', () => {
            shellMap.forEach(value => value.removeAllListeners());
            shellMap.clear();
            client.end();
          });

          // change on message callback
          ws.off('message', onHangOn);
          ws.on('message', async (message) => {
            const { tag, request } = JSON.parse(message.toString());
            const response = await (async () => {
              if (typeof request === 'object') {
                for (const [key, value] of Object.entries(request)) {
                  switch (key) {
                    case 'token':
                      return context.token.generate();
                    case 'shell':
                      if (typeof value === 'object' && value !== null && 'id' in value) {
                        if ('data' in value) {
                          // { shell: { id, data: <string> } }
                          const { id, data } = value as { id: string, data: string };
                          const stream = shellMap.get(id);
                          stream!.write(data);
                        } else if ('close' in value) {
                          // { shell: { id, close: <any> } }
                          const { id } = value as { id: string, close: any };
                          const stream = shellMap.get(id);
                          stream!.end();
                        }
                        return;
                      }
                      else if (typeof value === 'string')
                        return new Promise<{ open: string }>((resolve, reject) => {
                          client.shell((error, stream) => {
                            if (error) return reject(error);
                            const id = value;
                            if (shellMap.get(id) !== undefined) {
                              stream.end();
                              return reject(new Error('ID is in used'));
                            }
                            shellMap.set(id, stream);
                            stream.once('error', (error) => {
                              context.logger.error(`ssh2 shell stream error ${error}`);
                              stream.end();
                            });
                            stream.once('close', () => {
                              shellMap.delete(id);
                              ws.send(stringify({ event: { shell: { id, close: {} } } }));
                            });
                            stream.on('data',
                              (data: any) => ws.send(stringify({ event: { shell: { id, data: data.toString('binary') } } })));
                            resolve({ open: id });
                          });
                        });
                  }
                }
              }
              throw new Error('Unknown request')
            })().catch((error) => { error });
            if (ws.readyState === WebSocket.OPEN)
              ws.send(stringify({ tag, response }));
          });
          // notify sign in successfully
          ws.send(stringify({ token: context.token.generate() }));
        })
        .connect({
          port: 22,
          ...JSON.parse(message.toString()),
          host: 'localhost',
        });
    };
    ws.on('message', onHangOn);
    ws.once('error', () => wsSafeClose(ws));
  });
}

export default rest;