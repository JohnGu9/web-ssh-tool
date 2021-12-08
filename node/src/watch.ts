import path from 'path';
import ws, { WebSocket } from 'ws';
import fs, { Stats } from 'fs';
import { Context, exists, wsSafeClose } from './common';
import { FileType } from 'web/common/Type';


type File = { path: string, content: string, lstat: Stats & { type?: FileType } }
type Directory = { path: string, files: { [key: string]: Stats & { type?: FileType } }, lstat: Stats }

function getFileType(stats: Stats) {
  if (stats.isFile()) return FileType.file;
  if (stats.isDirectory()) return FileType.directory;
  if (stats.isBlockDevice()) return FileType.blockDevice;
  if (stats.isCharacterDevice()) return FileType.characterDevice;
  if (stats.isSymbolicLink()) return FileType.symbolicLink;
  if (stats.isFIFO()) return FileType.fifo;
  if (stats.isSocket()) return FileType.socket;
}

function watch(context: Context) {
  const wsServer = new ws.Server({ noServer: true });
  return wsServer.on('connection', (socket) => {
    socket.once('message', (data: string) => {
      const { token, cd } = JSON.parse(data);
      if (context.token.verify(token)) {
        let watcher: { watcher: fs.FSWatcher, path: string } | undefined;
        socket.once('close', () => watcher?.watcher.close());
        const buildState = async (p: string): Promise<File | Directory> => {
          const lstat = await fs.promises.lstat(p);
          const type = getFileType(lstat);
          if (lstat.isFile()) {
            const isExecutable = await exists(p, fs.constants.X_OK);
            return {
              path: p, lstat: { ...lstat, type },
              content: isExecutable ? 'Executable not support preview' : await fs.promises.readFile(p).then(buffer => buffer.toString())
            };
          } else if (lstat.isDirectory()) {
            const files: { [key: string]: Stats & { type?: FileType } } = {}
            for await (const { name } of await fs.promises.opendir(p)) {
              const lstat = await fs.promises.lstat(path.join(p, name));
              const type = getFileType(lstat);
              files[name] = { ...lstat, type };
            }
            return { path: p, lstat, files };
          } else {
            throw new Error(`Unsupported path [${p}] type ${lstat}`);
          }
        }

        const buildWatcher = (p: string): { watcher: fs.FSWatcher, path: string } | undefined => {
          const listener = async () => {
            const state = await buildState(p)
              .catch(function (error) { return { error } });
            if (socket.readyState === ws.OPEN && watcher?.path === p) socket.send(JSON.stringify(state));
          }
          try {
            const watcher = fs.watch(p, listener);
            listener();
            return { watcher, path: p };
          } catch (error) {
            if (socket.readyState === WebSocket.OPEN)
              socket.send(JSON.stringify({ error }));
          }
        }
        watcher = buildWatcher(cd ?? process.cwd());
        socket.on('message', async (data: string) => {
          const { cd } = JSON.parse(data);
          watcher?.watcher.close();
          watcher = buildWatcher(cd ?? process.cwd());
        });
      }
      else { wsSafeClose(socket) }
    })
    socket.once('error', () => wsSafeClose(socket));
  });
}

export default watch;