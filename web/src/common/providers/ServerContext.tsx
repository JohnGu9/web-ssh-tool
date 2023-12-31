import React from "react";
import { Rest } from "../Type";

export namespace Server {
  export interface Type {
    readonly ws: WebSocket;
    readonly id: number;
    signIn: (props: { username: string, password: string }) => Promise<{ token: string } | { error: Error }>;
  }
  export const Context = React.createContext<Type>(undefined as unknown as Type);

  export namespace Authentication {
    export type ShellEventDetail = { data: string } | { close: unknown };
    export type WatchEventDetail =
      { path: string | undefined, realPath: string | undefined } |
      { path: string | undefined, error: string | undefined };

    export interface Type {
      readonly shell: EventTarget;
      readonly watch: EventTarget;
      readonly notification: EventTarget;
      signOut(): void;
      upload(data: File, dest: Rest.PathLike, filename: string | null, init?: {
        signal?: AbortSignal | null
        onUploadProgress?: (progress: ProgressEvent) => unknown,
        onDownloadProgress?: (progress: ProgressEvent) => unknown,
      }): Promise<Express.Multer.File>;
      download(filePath: string | string[]): Promise<void>;
      previewUrl(path: string): Promise<URL>;
      preview(path: string): Promise<void>;
      rest<T extends keyof Rest.Map>(type: T, parameter: Rest.Map.Parameter<T>): Promise<Rest.Map.Return<T> | Rest.Error>;
    }
    export const Context = React.createContext<Type>(undefined as unknown as Type);
  }
}
