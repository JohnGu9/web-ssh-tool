import React from "react";
import { Server, Settings } from "../common/Providers";

import MultiFileExplorer from "./home-page/MultiFileExplorer";
import MultiTerminalView from "./home-page/MultiTerminalView";

function HomePage() {
  const server = React.useContext(Server.Context);
  const auth = React.useContext(Server.Authentication.Context);
  const settings = React.useContext(Settings.Context);
  return (
    <div className='full-size row'>
      <MultiTerminalView auth={auth} />
      <MultiFileExplorer auth={auth} server={server} settings={settings} />
    </div>
  );
}

export default HomePage;
