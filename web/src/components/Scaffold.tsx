import { Snackbar } from "rmcw";
import React from "react";
import delay from "../common/Delay";

function Scaffold({ children }: { children: React.ReactNode }) {
  const as = React.useMemo(() => new AsyncSequence(), []);
  const [open, setOpen] = React.useState(false);
  const [{ content, action, onDismiss }, setMessage] = React.useState<SnackbarQueueMessage
    & { onDismiss?: (...v: unknown[]) => unknown }>({});
  const context = React.useMemo<Scaffold.Snackbar.Type>(() => {
    return {
      showMessage: (v) => {
        as.postRaw(async () => {
          const dismiss = new Promise(resolve => {
            setMessage({ ...v, onDismiss: resolve });
          });
          setOpen(true);
          await Promise.race([
            dismiss,
            delay(3000)
          ]);
          setMessage(v => {
            v.onDismiss?.();
            return v;
          });
          setOpen(false);
          await delay(150);
        });
      },
      clearCurrent: () => {
        setMessage(v => {
          v.onDismiss?.();
          return v;
        });
      },
      clearAll: () => {
        as.clear();
        setMessage(v => {
          v.onDismiss?.();
          return v;
        });
      },
    };
  }, [as]);
  return (
    <>
      <Scaffold.Snackbar.Context.Provider value={context}>
        {children}
      </Scaffold.Snackbar.Context.Provider>
      <Snackbar open={open} action={action} onDismiss={onDismiss}>
        {content}
      </Snackbar>
    </>
  );
}

export type SnackbarQueueMessage = { content?: React.ReactNode, action?: React.ReactNode };

namespace Scaffold {
  export namespace Snackbar {
    export type Type = {
      showMessage: (message: SnackbarQueueMessage) => unknown,
      clearCurrent: () => unknown,
      clearAll: () => unknown,
    };
    export const Context = React.createContext<Type>(undefined as unknown as Type);
  }
}

export default Scaffold;

class AsyncSequence {
  protected _running = false;
  protected _fns: (() => Promise<unknown>)[] = [];

  protected async _run() {
    if (this._running) return;
    this._running = true;
    while (true) {
      const p = this._fns.shift();
      if (p === undefined) break;
      await p();
    }
    this._running = false;
  }

  post<T>(fn: () => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      this._fns.push(async () => {
        try {
          const t = await fn();
          resolve(t);
        } catch (error) {
          reject(error);
        }
      });
      this._run();
    });
  }

  postRaw(fn: () => Promise<unknown>) {
    this._fns.push(async () => {
      try {
        await fn();
      } catch (error) {

      }
    });
    this._run();
  }

  clear() {
    while (this._fns.length > 0) {
      this._fns.pop();
    }
  }
}
