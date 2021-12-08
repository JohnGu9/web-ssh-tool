import React from "react";
import { Server } from "../common/Providers";

import FileExplorer from "./home-page/FileExplorer";
import MultiTerminalView from "./home-page/MultiTerminalView";

function HomePage() {
  const auth = React.useContext(Server.Authentication.Context);
  return (
    <div className='full-size row'>
      <MultiTerminalView auth={auth} />
      <div style={{ flex: 2, minWidth: 0, height: '100%' }}><FileExplorer /></div>
    </div>
  );
}

export default HomePage;
