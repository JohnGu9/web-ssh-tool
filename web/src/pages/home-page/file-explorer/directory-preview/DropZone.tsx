import path from "path-browserify";
import React from "react";
import { Server } from "../../../../common/Providers";
import { Rest } from "../../../../common/Type";
import FileExplorer from "../Common";

function DropZone({ children, style, dirname }: { children: React.ReactNode, dirname: string, style?: React.CSSProperties }) {
  const { upload } = React.useContext(FileExplorer.Context);
  const [drag, setDrag] = React.useState(false);
  const [disabled, setDisabled] = React.useState(false);
  const auth = React.useContext(Server.Authentication.Context);
  return <div style={{
    ...style,
    transition: 'opacity 300ms, border 300ms',
    boxSizing: 'border-box', position: 'relative',
    opacity: drag && disabled === false ? 0.5 : 1,
    border: drag && disabled === false ? '3px dotted #666' : '3px dotted rgba(0,0,0,0)',
  }}
    onDragEnter={event => {
      event.preventDefault();
      setDrag(true);
    }}
    onDragLeave={event => {
      event.preventDefault();
      setDrag(false);
    }}
    onDragOver={event => {
      event.preventDefault();
      if (drag === false) setDrag(true);
    }}
    onDrop={event => {
      event.preventDefault();
      setDrag(false);
      if (disabled) return;
      const { items, files } = event.dataTransfer;
      if (items && items.length > 0 && 'webkitGetAsEntry' in items[0]) {
        try {
          for (let i = 0; i < items.length; i++) {
            const entry = items[i].webkitGetAsEntry();
            if (entry) uploadItem(dirname, entry, upload, auth);
          }
          return;
        } catch (error) {
          // browser not support webkit
        }
      }
      for (let i = 0; i < files.length; i++)
        upload(files[i], dirname);
    }}
  >
    <DropZone.Context.Provider value={{ setDisabled: setDisabled }}>
      {children}
    </DropZone.Context.Provider>
  </div>;
}

namespace DropZone {
  export type Type = { setDisabled: (value: boolean) => unknown };
  export const Context = React.createContext<Type>(undefined as unknown as Type);
}

export default DropZone;

async function uploadItem(dest: string, entry: FileSystemEntry, upload: (file: File, dest: string) => void, auth: Server.Authentication.Type): Promise<unknown> {
  if (entry.isFile) {
    const file = await new Promise<File>(resolve => (entry as unknown as any).file(resolve));
    return upload(file, dest);
  } else if (entry.isDirectory) {
    const newDest = path.join(dest, entry.name);
    const dirReader = (entry as unknown as any).createReader();
    const [result, entries] = await Promise.all([
      auth.rest('fs.mkdir', [newDest]),
      new Promise<FileSystemEntry[]>(resolve => dirReader.readEntries(resolve)),
    ]);
    if (Rest.isError(result)) return;
    const list = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      list.push(uploadItem(newDest, entry, upload, auth));
    }
    return Promise.all(list);
  }
}
