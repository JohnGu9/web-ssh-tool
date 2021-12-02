import React from "react";

export namespace Server {
  export interface Type { };
  export const Context = React.createContext<Type>(undefined as unknown as Type);

  export namespace Authentication {
    export const Context = React.createContext<Type>(undefined as unknown as Type);
    export interface Type {
      upload: (data: File | FormData) => Promise<Express.Multer.File>,
      download: (filePath: string) => Promise<void>,
    };
  }
}
