import React from "react";
import { Server, Settings } from "../common/Providers";

import MultiFileExplorer from "./home-page/MultiFileExplorer";
import MultiTerminalView from "./home-page/MultiTerminalView";
import Scaffold from "../components/Scaffold";
import iconv from 'iconv-lite';

function HomePage() {
  const server = React.useContext(Server.Context);
  const auth = React.useContext(Server.Authentication.Context);
  const settings = React.useContext(Settings.Context);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const textDecoder = React.useMemo(
    () => {
      try {
        if (iconv.encodingExists(settings.textDecode ?? 'utf-8') === false) {
          throw new Error('iconv not support');
        }
        return settings.textDecode ?? 'utf-8';
      } catch (e) {
        showMessage({ content: `Failed to enable text decoder [${settings.textDecode}]. Fallback to [utf-8].` });
        requestAnimationFrame(() => settings.setTextDecode(null));
        return 'utf-8';
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.textDecode]);
  return (
    <>
      <MultiTerminalView auth={auth} textDecoder={textDecoder} />
      <MultiFileExplorer auth={auth} server={server} settings={settings} />
    </>
  );
}

export default HomePage;
