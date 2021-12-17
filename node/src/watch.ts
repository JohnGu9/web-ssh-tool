import path from 'path';
import os from 'os';
import ws, { WebSocket } from 'ws';
import fs, { Stats } from 'fs';
import { Context, getFileType, wsSafeClose } from './common';
import { FileType, Watch } from 'web/common/Type';

function watch(context: Context) {
  const wsServer = new ws.Server({ noServer: true, perMessageDeflate: true });
  return wsServer.on('connection', (socket, req) => {
    socket.once('message', (data: string) => {
      const { token, cd } = JSON.parse(data);
      if (context.token.verify(token)) {
        const pipeline = new PipeLine();
        let watcher: { watcher: fs.FSWatcher, path: string } | undefined;
        socket.once('close', () => watcher?.watcher.close());
        const buildState = async (p: string): Promise<Watch.File | Watch.Directory> => {
          const lstat = await fs.promises.lstat(p);
          const type = getFileType(lstat);
          if (lstat.isFile()) {
            return {
              path: p, lstat: { ...lstat, type },
              content: await fs.promises.readFile(p).then(buffer => buffer.toString('base64'))
            };
          } else if (lstat.isDirectory()) {
            const files: { [key: string]: Stats & { type?: FileType } } = {}
            for await (const { name } of await fs.promises.opendir(p)) {
              const lstat = await fs.promises.lstat(path.join(p, name));
              const type = getFileType(lstat);
              files[name] = { ...lstat, type };
            }
            return { path: p, lstat: { ...lstat, type }, files };
          } else {
            throw new Error(`Unsupported path [${p}] type ${lstat}`);
          }
        }

        const buildWatcher = (p: string): { watcher: fs.FSWatcher, path: string } | undefined => {
          const listener = () => pipeline.post(async () => {
            const state = await buildState(p)
              .catch(function (error) { return { error } });
            if (socket.readyState === ws.OPEN && watcher?.path === p) {
              try {
                socket.send(JSON.stringify(state));
              } catch (error) {
                socket.send(JSON.stringify({ error }));
              }
            }
          });
          try {
            const watcher = fs.watch(p, listener);
            listener();
            return { watcher, path: p };
          } catch (error) {
            if (socket.readyState === WebSocket.OPEN)
              socket.send(JSON.stringify({ error }));
          }
        }
        watcher = buildWatcher(cd ?? context.home ?? os.homedir());
        socket.on('message', async (data: string) => {
          const { cd } = JSON.parse(data);
          if (watcher && cd === watcher.path) return pipeline.post(async () => {
            const state = await buildState(cd)
              .catch(function (error) { return { error } });
            if (socket.readyState === ws.OPEN && watcher?.path === cd) {
              try {
                socket.send(JSON.stringify(state));
              } catch (error) {
                socket.send(JSON.stringify({ error }));
              }
            }
          });
          watcher?.watcher.close();
          watcher = buildWatcher(cd ?? context.home ?? os.homedir());
        });
      }
      else {
        wsSafeClose(socket);
        context.logger.error(`watch token from [${req.socket.remoteAddress}] verify failed`);
      }
    })
    socket.once('error', (error) => {
      wsSafeClose(socket);
      context.logger.error(`watch websocket error [${error}] from [${req.socket.remoteAddress}]`);
    });
  });
}

export default watch;

class PipeLine {
  protected _running: boolean = false;
  protected _queue: Array<() => Promise<any>> = [];

  public post(fn: () => Promise<any>): void {
    this._queue.push(fn);
    if (this._running === true) return;
    // start event loop
    this._running = true;
    const run = async () => {
      while (true) {
        const fn = this._queue.shift();
        if (fn) await fn();
        else break;
      };
      this._running = false;
    };
    run();
  }
}