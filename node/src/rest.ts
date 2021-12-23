import { Context, exists, wsSafeClose } from "./common";
import ws, { RawData, WebSocket } from 'ws';
import { Client, ClientChannel } from 'ssh2';
import fs from 'fs/promises';

async function rest(context: Context) {
  const wsServer = new ws.Server({ noServer: true });
  const { stringify } = JSON;
  return wsServer.on('connection', (ws, req) => {
    const onHangOn = (message: RawData) => {
      const client = new Client();
      client
        .once('error', (error) => {
          client.removeAllListeners();
          if (ws.readyState !== WebSocket.OPEN) {
            client.end();
            return;
          }

          // notify sign in failed
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
                    case 'fs.unlink':
                      return fs.unlink(...value as Parameters<typeof fs.unlink>);
                    case 'fs.rm':
                      return fs.rm(...value as Parameters<typeof fs.rm>);
                    case 'fs.rename':
                      return fs.rename(...value as Parameters<typeof fs.rename>);
                    case 'fs.exists':
                      return exists(...value as Parameters<typeof fs.access>);
                    case 'fs.mkdir':
                      return fs.mkdir(...value as Parameters<typeof fs.mkdir>);
                    case 'fs.writeFile':
                      return fs.writeFile(...value as Parameters<typeof fs.writeFile>);
                    case 'fs.cp':
                      return fs.cp(...value as Parameters<typeof fs.cp>);
                    case 'shell':
                      if (typeof value === 'object' && value !== null && 'id' in value) {
                        if ('data' in value) {
                          // { shell: { id, data: <string> } }
                          const { id, data } = value as { id: string, data: string };
                          const stream = shellMap.get(id);
                          stream!.write(data);
                        } else if ('resize' in value) {
                          // { shell: { id, resize: { height: 100 width: 100 } } }
                          const { id, resize: { cols, rows, height, width } } = value as { id: string, resize: { rows: number, cols: number, height: number, width: number } };
                          const stream = shellMap.get(id);
                          stream?.setWindow(rows, cols, height, width);
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
          ...JSON.parse(message.toString()), // port can be override but host can't
          host: 'localhost',
        });
    };
    ws.on('message', onHangOn);
    ws.once('error', () => wsSafeClose(ws));
  });
}

export default rest;
