import ws from 'ws';
import fs, { PathLike } from 'fs';
import { Context, wsSafeClose } from './common';

type WatcherError = { error: Error };
type WatcherFile = { file: fs.Stats, path: PathLike };
type WatcherDirectory = { directory: fs.Stats, path: PathLike };

type Watcher = { fsWatcher: fs.FSWatcher, state: WatcherError | WatcherFile | WatcherDirectory };

function watch(context: Context) {
  const wsServer = new ws.Server({ noServer: true });
  return wsServer.on('connection', (socket) => {
    socket.once('message', async (data: string) => {
      const { token, cd } = JSON.parse(data);
      if (context.token.verify(token)) {
        let watcher: Watcher | undefined;
        socket.once('close', () => watcher?.fsWatcher.close());
        const buildState = async (p: PathLike) => {
          const state = await fs.promises.lstat(p);
          if (state.isFile()) {
            return { file: state, path: p };
          } else if (state.isDirectory()) {
            return { directory: state, path: p };
          } else {
            throw new Error(`Unsupported path [${p}] type ${state}`);
          }
        }

        const buildWatcher = async (p: PathLike): Promise<Watcher> => {
          const state = await buildState(p)
            .catch(function (error: Error) { return { error } });
          const listener = async () => {
            const state = await buildState(p)
              .catch(function (error: Error) { return { error } });
            if (socket.readyState === ws.OPEN) {
              if (watcher) watcher.state = state;
              socket.send(JSON.stringify(state));
            }
          }
          return { fsWatcher: fs.watch(p, listener), state: state, };
        }
        const cleanup = () => {
          switch (socket.readyState) {
            case ws.CLOSED:
            case ws.CLOSING:
              watcher?.fsWatcher.close();
              return watcher = undefined;
            default:
              return socket.send(JSON.stringify(watcher?.state));
          }
        }
        watcher = await buildWatcher(cd);
        cleanup();
        if (socket.readyState === ws.OPEN)
          socket.on('message', async (data: string) => {
            const obj = JSON.parse(data);
            const { cd } = obj;
            if (cd && typeof cd === 'string') {
              watcher?.fsWatcher.close();
              watcher = undefined;
              watcher = await buildWatcher(cd);
              cleanup();
            }
          });
      }
      else { wsSafeClose(socket) }
    })
    socket.once('error', () => wsSafeClose(socket));
  });
}

export default watch;