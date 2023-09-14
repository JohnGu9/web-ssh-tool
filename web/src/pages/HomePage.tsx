import React from "react";
import { Server, Settings } from "../common/Providers";

import MultiFileExplorer from "./home-page/MultiFileExplorer";
import MultiTerminalView from "./home-page/MultiTerminalView";
import Scaffold from "../components/Scaffold";
import iconv from 'iconv-lite';
import LayoutBuilder from "../components/LayoutBuilder";

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
    <LayoutBuilder
      className="full-size"
      builder={function (size) {
        if (size === undefined) return undefined;
        if (size.width < 800) {
          return (
            <div className="full-size column">
              <MultiTerminalView auth={auth} textDecoder={textDecoder} />
              <MyResize axis="y">
                <MultiFileExplorer auth={auth} server={server} settings={settings} />
              </MyResize>
            </div>);
        } else {
          return (
            <div className="full-size row">
              <MultiTerminalView auth={auth} textDecoder={textDecoder} />
              <MyResize axis="x">
                <MultiFileExplorer auth={auth} server={server} settings={settings} />
              </MyResize>
            </div>
          );
        }
      }} />
  );
}

export default HomePage;

function MyResize({ children, axis }: { children: React.ReactNode, axis: 'x' | 'y' }) {
  const [enable, setEnable] = React.useState(0);
  const [width, setWidth] = React.useState(320);
  const startDrag = enable > 0;
  React.useEffect(() => {
    const onUp = () => setEnable(v => Math.max(v - 1, 0));
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mouseup', onUp);
    }
  });
  React.useEffect(() => {
    if (startDrag) {
      const onMove = axis === 'x' ?
        (e: Event) => {
          e.preventDefault();
          setWidth(width => Math.max(width - (e as MouseEvent).movementX, 300));
        } :
        (e: Event) => {
          e.preventDefault();
          setWidth(width => Math.max(width - (e as MouseEvent).movementY, 300));
        };
      window.addEventListener('mousemove', onMove);
      return () => {
        window.removeEventListener('mousemove', onMove);
      }
    }
  }, [axis, startDrag]);
  const [d0, d1]: [React.CSSProperties, React.CSSProperties] = axis === 'x' ? [
    { position: 'relative', height: '100%', width: width },
    { position: 'absolute', height: '100%', width: 8, left: 0, top: 0, cursor: 'ew-resize' },
  ] : [
    { position: 'relative', height: width, width: '100%' },
    { position: 'absolute', height: 8, width: '100%', left: 0, top: 0, cursor: 'ns-resize' },
  ];
  return (
    <div style={d0}>
      {children}
      <div style={d1}
        onMouseDown={(e) => {
          e.preventDefault();
          setEnable(v => v + 1);
        }}></div>
    </div>
  );
}
