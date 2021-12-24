import React from "react";
import { Rest } from "../Type";


export namespace Server {
  export interface Type {
    readonly ws: WebSocket;
    signIn: (props: { username: string, password: string }) => Promise<{ token: string } | { error: Error }>;
  };
  export const Context = React.createContext<Type>(undefined as unknown as Type);

  export namespace Authentication {
    export type ShellEventDetail = { data: string } | { close: any };
    export type ShellEvent = CustomEvent<ShellEventDetail>;

    export interface Type {
      readonly ws: WebSocket;
      readonly shell: EventTarget;
      signOut(): void;
      upload(data: File | FormData, init?: RequestInit): Promise<Express.Multer.File>;
      download(filePath: string | string[]): Promise<void>;
      rest<T extends keyof Rest.Map>(type: T, parameter: Rest.Map.Parameter<T>): Promise<Rest.Map.Return<T> | Rest.Error>;
    };
    export const Context = React.createContext<Type>(undefined as unknown as Type);
  }
}
