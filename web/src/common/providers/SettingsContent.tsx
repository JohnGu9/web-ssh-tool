import React from "react";
import { StorageContext, StorageContextType } from "./StorageContext";

export namespace Settings {
  export const Context = React.createContext<Type>(undefined as unknown as Type);
  export type Type = {
    locale: string | null,
    setLocale: (_: string | null) => void,

    sshSave: boolean,
    setSshSave: (_: boolean) => void,

    sshUserName: string | null,
    setSshUserName: (_: string | null) => void,

    sshPassword: string | null,
    setSshPassword: (_: string | null) => void,

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

    render() {
      return (
        <Context.Provider value={{
          get locale() { return localStorage.getItem('locale') },
          setLocale: this._stringKeyCallback('locale'),

          get sshSave() { return localStorage.getItem('ssh-save') !== null },
          setSshSave: this._boolKeyCallback('ssh-save'),

          get sshUserName() { return localStorage.getItem('ssh-user-name') },
          setSshUserName: this._stringKeyCallback('ssh-user-name'),

          get sshPassword() { return localStorage.getItem('ssh-password') },
          setSshPassword: this._stringKeyCallback('ssh-password'),
        }}>
          {this.props.children}
        </Context.Provider>
      );
    }
  }

  namespace Service {
    export type Props = {
      storage: StorageContextType,
    }
  }
}

export function SettingsService(props: { children?: React.ReactNode }) {
  const storage = React.useContext(StorageContext);
  return <Settings.Service storage={storage}>{props.children}</Settings.Service>;
}
