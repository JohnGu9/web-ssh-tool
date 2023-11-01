import React from "react";
import { Settings } from "./SettingsContent";

// @TODO: use i18n for locale

const english = {
  signIn: 'Sign in',
  signOut: 'Sign out',
  next: 'Next',
  help: 'Help',
  username: 'Username',
  password: 'Password',
  ok: 'OK',
  cancel: 'Cancel',
  rememberPassword: 'Remember Password',
  keepSignIn: 'Keep Sign in',
  connecting: 'Connecting'
};

// const chineseSimplified = {
//   ...english,
//   signIn: '登录',
//   signOut: '登出',
//   next: '下一步',
//   help: '帮助',
//   username: '用户名',
//   password: '密码',
//   ok: '好的',
//   cancel: '取消',
//   close: '关闭',
//   keepSignIn: '保持登录状态',
//   connecting: '连接中',
// };

// const japanese = {
//   ...english,
//   signIn: 'ログイン',
//   signOut: 'ログアウト',
//   next: '次へ',
//   help: 'ヘルプ',
//   username: 'ユーザー',
//   password: 'パスワード',
//   ok: 'はい',
//   cancel: 'いいえ',
//   close: '閉じる',
//   keepSignIn: 'ログイン状態を保持する',
//   connecting: '接続中',
// };

const defaultLocale = {
  name: 'English',
  meta: english,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  toggle: function (_: string) { }
}
export type LocaleContextType = typeof defaultLocale;
export const LocaleContext = React.createContext<LocaleContextType>(defaultLocale);

export function LocaleService({ children }: { children: React.ReactNode }) {
  const settings = React.useContext(Settings.Context);
  return (
    <LocaleService.Service settings={settings}>
      {children}
    </LocaleService.Service>
  );
}

function buildState(locale: string) {
  switch (locale) {
    // case 'zh':
    // case 'zh-CN':
    //   return {
    //     name: 'Chinese (Simplified)',
    //     locale: chineseSimplified,
    //   };
    default:
      return {
        name: 'English',
        meta: english,
      };
  }
}

export namespace LocaleService {
  export class Service extends React.Component<Service.Props, Service.State> {
    constructor(props: Service.Props) {
      super(props);
      const currentLocale = props.settings.locale ?? window.navigator.language;
      const toggle = (newLocale: string) => {
        this.props.settings.setLocale(newLocale);
        this.setState(buildState(newLocale));
      }
      this.state = {
        ...buildState(currentLocale),
        toggle: toggle,
      }
    }

    override render() {
      return (
        <LocaleContext.Provider value={this.state}>
          {this.props.children}
        </LocaleContext.Provider>
      );
    }
  }

  namespace Service {
    export type Props = {
      children: React.ReactNode,
      settings: Settings.Type,
    }
    export type State = LocaleContextType
  }
}
