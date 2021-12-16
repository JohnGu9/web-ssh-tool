import { createSnackbarQueue, SnackbarQueue } from "@rmwc/snackbar";
import React from "react";

function Scaffold({ children }: { children: React.ReactNode }) {
  return <Snackbar>{children}</Snackbar>;
}

namespace Scaffold {
  export namespace Snackbar {
    export const { messages, notify } = createSnackbarQueue();
    export type Type = { showMessage: typeof notify };
    export const Context = React.createContext<Type>(undefined as unknown as Type);
  }
}

export default Scaffold;

function Snackbar({ children }: { children: React.ReactNode }) {
  const { messages, notify } = Scaffold.Snackbar;
  return (
    <>
      <Scaffold.Snackbar.Context.Provider value={{ showMessage: notify }}>
        {children}
      </Scaffold.Snackbar.Context.Provider>
      <SnackbarQueue messages={messages} dismissesOnAction></SnackbarQueue>
    </>
  );
}