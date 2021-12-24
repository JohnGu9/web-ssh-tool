import path from 'path';
import os from 'os';
import ws, { WebSocket } from 'ws';
import fs from 'fs';
import { Context, getFileType, wsSafeClose } from './common';
import { FileType, Lstat, Watch } from 'web/common/Type';

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
          const lstat = await fs.promises.lstat(await fs.promises.realpath(p));
          const type = getFileType(lstat);
          switch (type) {
            case FileType.file: {
              return {
                path: p, lstat: { ...lstat, type },
                content: await fs.promises.readFile(p)
                  .then(buffer => buffer.toString('base64')),
              };
            }
            case FileType.directory: {
              const files: { [key: string]: Lstat } = {}
              for await (const { name } of await fs.promises.opendir(p)) {
                const fullPath = path.join(p, name);
                const lstat = await fs.promises.lstat(fullPath);
                const type = getFileType(lstat);
                switch (type) {
                  case FileType.symbolicLink: {
                    try {
                      const realPath = await fs.promises.realpath(fullPath);
                      const realLstat = await fs.promises.lstat(realPath);
                      const realType = getFileType(realLstat);
                      files[name] = { ...lstat, type, realPath, realType };
                    } catch {
                      files[name] = { ...lstat, type };
                    }
                    break;
                  }
                  default:
                    files[name] = { ...lstat, type };
                }

              }
              return { path: p, lstat: { ...lstat, type }, files };
            }
          }
          throw new Error(`Unsupported path [${p}] type ${lstat}`);
        }
        const notifyState = async (p: string) => {
          const state = await buildState(p)
            .catch(function (error) { return { error, path: p } });
          if (socket.readyState === ws.OPEN && watcher?.path === p) {
            try {
              socket.send(JSON.stringify(state));
            } catch (error) {
              socket.send(JSON.stringify({ error }));
            }
          }
        }

        const buildWatcher = (p: string): { watcher: fs.FSWatcher, path: string } | undefined => {
          const listener = () => pipeline.post(async () => notifyState(p));
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
          if (watcher && cd === watcher.path) return pipeline.post(async () => notifyState(cd));
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