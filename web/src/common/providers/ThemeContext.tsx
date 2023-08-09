import { Theme, ThemeProps, defaultLightTheme, defaultDarkTheme } from "rmcw";
import React from "react";
import { Settings } from "./SettingsContent";

export const ThemeContext = React.createContext<ThemeService.State>({ themeData: defaultLightTheme, isDark: false });
const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

export function ThemeService({ children }: ThemeService.Props) {
  const setting = React.useContext(Settings.Context);
  const isDark = (() => {
    switch (setting.darkMode) {
      case 'dark':
        return true;
      case 'light':
        return false;
      default:
        return mediaQueryList.matches;
    }
  })();
  const themeData = isDark ? defaultDarkTheme : defaultLightTheme;
  return (
    <ThemeContext.Provider value={{ isDark, themeData }}>
      <Theme {...defaultLightTheme}
        darkTheme={defaultDarkTheme}
        enableDarkTheme={isDark}
        style={{
          height: '100%',
          width: '100%',
        }}>
        {children}
      </Theme>
    </ThemeContext.Provider>
  );
}

namespace ThemeService {
  export type Props = { children: React.ReactNode }
  export type State = { themeData: ThemeProps, isDark: boolean }
}
