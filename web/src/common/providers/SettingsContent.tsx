import React from "react";
import { StorageContext, StorageContextType } from "./StorageContext";

export namespace Settings {
  export const Context = React.createContext<Type>(undefined as unknown as Type);
  export type Type = {
    locale: string | null,
    setLocale: (value: string | null) => void,

    rememberPassword: boolean,
    setRememberPassword: (value: boolean) => void,

    sshUserName: string | null,
    setSshUserName: (value: string | null) => void,

    sshPassword: string | null,
    setSshPassword: (value: string | null) => void,

    lastPath: string | null,
    setLastPath: (value: string | null) => void,

    textDecode: string | null,
    setTextDecode: (value: string | null) => void,

    darkMode: 'dark' | 'light' | null,
    setDarkMode: (value: 'dark' | 'light' | null) => void,

    quickCommands: string | null,
    setQuickCommands: (value: string | null) => void,

    layout: 'terminal' | 'file-explorer' | null,
    setLayout: (value: 'terminal' | 'file-explorer' | null) => void,
  };

  export class Service extends React.Component<Service.Props> {
    get localStorage() { return this.props.storage.localStorage }

    _boolKeyCallback(key: string) {
      return (newValue: boolean) => {
        newValue
          ? localStorage.setItem(key, '')
          : localStorage.removeItem(key);
        this.setState({});
      }
    }

    _stringKeyCallback(key: string) {
      return (newValue: string | null) => {
        newValue
          ? localStorage.setItem(key, newValue)
          : localStorage.removeItem(key);
        this.setState({});
      }
    }

    override render() {
      return (
        <Context.Provider value={{
          get locale() { return localStorage.getItem('locale') },
          setLocale: this._stringKeyCallback('locale'),

          get rememberPassword() { return localStorage.getItem('remember-password') !== null },
          setRememberPassword: this._boolKeyCallback('remember-password'),

          get sshUserName() { return localStorage.getItem('ssh-user-name') },
          setSshUserName: this._stringKeyCallback('ssh-user-name'),

          get sshPassword() { return localStorage.getItem('ssh-password') },
          setSshPassword: this._stringKeyCallback('ssh-password'),

          get lastPath() { return localStorage.getItem('last-path') },
          setLastPath: this._stringKeyCallback('last-path'),

          get darkMode() { return localStorage.getItem('dark-mode') as null },
          setDarkMode: this._stringKeyCallback('dark-mode'),

          get textDecode() { return localStorage.getItem('text-decode') },
          setTextDecode: this._stringKeyCallback('text-decode'),

          get quickCommands() { return localStorage.getItem('quick-commands') },
          setQuickCommands: this._stringKeyCallback('quick-commands'),

          get layout() { return localStorage.getItem('layout') as null },
          setLayout: this._stringKeyCallback('layout'),
        }}>
          {this.props.children}
        </Context.Provider>
      );
    }
  }

  namespace Service {
    export type Props = {
      storage: StorageContextType,
      children?: React.ReactNode,
    }
  }
}

export function SettingsService(props: { children?: React.ReactNode }) {
  const storage = React.useContext(StorageContext);
  return <Settings.Service storage={storage}>{props.children}</Settings.Service>;
}
