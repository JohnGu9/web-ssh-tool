import React from "react";
import { Server } from "../../../../common/Providers";
import { Rest } from "../../../../common/Type";
import FileExplorer from "../Common";
import Scaffold from "../../../../components/Scaffold";

function DropZone({ children, style, dirname }: { children: React.ReactNode, dirname: string | null | undefined, style?: React.CSSProperties }) {
  const { upload } = React.useContext(FileExplorer.Context);
  const [drag, setDrag] = React.useState(false);
  const [dragging, setDragging] = React.useState<unknown | null>(null); // when any element is dragging
  const [hovering, setHovering] = React.useState<HTMLElement | null>(null);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const auth = React.useContext(Server.Authentication.Context);

  React.useEffect(() => {
    if (dragging === null) {
      setHovering(null);
    }
  }, [dragging]);

  return <div style={{
    ...style,
    transition: 'opacity 300ms, border 300ms',
    boxSizing: 'border-box', position: 'relative',
    opacity: drag && dragging === null ? 0.5 : 1,
    border: drag && dragging === null ? '3px dotted #666' : '3px dotted rgba(0,0,0,0)',
  }}
    onDragEnter={event => {
      event.preventDefault();
      const { items, files } = event.dataTransfer;
      if ((items && items.length > 0 && 'webkitGetAsEntry' in items[0]) || files.length > 0)
        setDrag(true);

      if (dragging !== null) {
        const { target } = event;
        if (target instanceof HTMLElement) {
          if (target.dataset['dropzone'] !== undefined)
            setHovering(target);
        }

      }
    }}
    onDragLeave={event => {
      event.preventDefault();
      setDrag(false);
    }}
    onDragOver={event => {
      event.preventDefault();
      const { items, files } = event.dataTransfer;
      if ((items && items.length > 0 && 'webkitGetAsEntry' in items[0]) || files.length > 0)
        setDrag(true);
    }}
    onDrop={event => {
      event.preventDefault();
      setDrag(false);
      if (dragging !== undefined) return;
      if (dirname === undefined || dirname === null) return; // @TODO: dialog show error message
      const { items, files } = event.dataTransfer;
      if (items && items.length > 0 && 'webkitGetAsEntry' in items[0]) {
        try {
          for (let i = 0; i < items.length; i++) {
            const entry = items[i].webkitGetAsEntry();
            if (entry) uploadItem([dirname], entry, upload, auth, 0);
          }
          return;
        } catch (error) {
          // browser not support webkit
          showMessage({ content: `Upload failed (${error})` });
        }
      }
      for (let i = 0; i < files.length; i++)
        upload(files[i], [dirname]);
    }}
  >
    <DropZone.Context.Provider value={{ hovering, dragging, setDragging }}>
      {children}
    </DropZone.Context.Provider>
  </div>;
}

namespace DropZone {
  export type Type = { hovering: HTMLElement | null, dragging: unknown | null, setDragging: (value: unknown | null) => unknown };
  export const Context = React.createContext<Type>(undefined as unknown as Type);
  export const noDrop = {};
}

export default DropZone;

async function uploadItem(dest: Rest.PathLike, entry: FileSystemEntry, upload: (file: File, dest: Rest.PathLike) => void, auth: Server.Authentication.Type, depth: number): Promise<unknown> {
  if (entry.isFile) {
    const file = await new Promise<File>(resolve => (entry as unknown as any).file(resolve));
    return upload(file, dest);
  } else if (entry.isDirectory) {
    const MAX_DEPTH = 2;
    if (depth >= MAX_DEPTH) return;
    const dirReader = (entry as unknown as any).createReader();
    const newDest = [...dest, entry.name];
    const [result, entries] = await Promise.all([
      auth.rest('fs.mkdir', [newDest]),
      new Promise<FileSystemEntry[]>(resolve => dirReader.readEntries(resolve)),
    ]);
    if (Rest.isError(result)) return;
    const list = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      list.push(uploadItem(newDest, entry, upload, auth, depth + 1));
    }
    return Promise.all(list);
  }
}
