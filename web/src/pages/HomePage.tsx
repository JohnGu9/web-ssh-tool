import React from "react";
import { Server, Settings } from "../common/Providers";

import MultiFileExplorer from "./home-page/MultiFileExplorer";
import MultiTerminalView from "./home-page/MultiTerminalView";
import Scaffold from "../components/Scaffold";
import LayoutBuilder from "../components/LayoutBuilder";
import { Layout } from "../common/Type";

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

  const [layout, setLayoutInternal] = React.useState(() => {
    switch (settings.layout) {
      case 'file-explorer':
        return Layout.fileExplorer;
      case 'terminal':
        return Layout.terminal;
    }
    return Layout.both;
  });
  const setLayout = (layout: Layout) => {
    setLayoutInternal(layout);
    switch (layout) {
      case Layout.both:
        settings.setLayout(null);
        break;
      case Layout.terminal:
        settings.setLayout('terminal');
        break;
      case Layout.fileExplorer:
        settings.setLayout('file-explorer');
        break;
    }
  };

  React.useEffect(() => {
    const listener = (e: Event) => showMessage({ content: (e as CustomEvent<string>).detail });
    auth.notification.addEventListener('change', listener);
    return () => {
      auth.notification.removeEventListener('change', listener);
    };
  }, [auth.notification, showMessage]);

  return (
    <HomePage.Context.Provider value={{ layout, setLayout }}>
      <LayoutBuilder
        className="full-size"
        builder={(size) => {
          return <MyLayout size={size} layout={layout}
            firstChild={<MultiTerminalView auth={auth} textDecoder={textDecoder} />}
            secondChild={<MultiFileExplorer auth={auth} server={server} />} />
        }} />
    </HomePage.Context.Provider>
  );
}

namespace HomePage {
  export const Context = React.createContext(undefined as unknown as ContextType);
  export type ContextType = {
    layout: Layout,
    setLayout: (newLayout: Layout) => unknown,
  };
}

export default HomePage;

function MyLayout({ size, layout, firstChild, secondChild }: {
  size: LayoutBuilder.Size | undefined,
  layout: Layout,
  firstChild: React.ReactNode,
  secondChild: React.ReactNode,
}) {

  const [length, setLength] = React.useState(320);
  const firstWrapRef = React.useRef<HTMLDivElement>(null);
  const secondWrapRef = React.useRef<HTMLDivElement>(null);
  const [delayLayout, setDelayLayout] = React.useState(layout);
  const [lastLayout, setLastLayout] = React.useState(layout);
  const syncLayout = () => {
    setLastLayout(delayLayout);
    setDelayLayout(layout);
  }
  if (size === undefined) return undefined;
  const [className, axis]: [string, 'x' | 'y'] = size.width < 800 ?
    ["full-size column", "y"] :
    ["full-size row", "x"];
  const sizeLength = axis === 'x' ? size.width : size.height;

  switch (delayLayout) {
    case Layout.both:
      return (
        <div className={className} style={{ alignItems: 'stretch' }}>
          <div key={0}
            ref={firstWrapRef}
            className="expanded"
            style={layout === Layout.fileExplorer ?
              {
                opacity: 0,
                transition: 'opacity 150ms',
                willChange: 'opacity',
              } :
              {
                opacity: 1,
                transition: 'opacity 150ms',
              }}
            onTransitionEnd={e => {
              if (layout === Layout.fileExplorer &&
                e.target === firstWrapRef.current) {
                syncLayout();
              }
            }}>
            {firstChild}
          </div>
          <MyResize key={1}
            divRef={secondWrapRef}
            length={length}
            setLength={setLength}
            axis={axis}
            style={layout === Layout.terminal ?
              {
                opacity: 0,
                transition: 'opacity 150ms',
                willChange: 'opacity',
              } :
              {
                opacity: 1,
                transition: 'opacity 150ms',
              }}
            onTransitionEnd={e => {
              if (layout === Layout.terminal &&
                e.target === secondWrapRef.current) {
                syncLayout();
              }
            }}>
            {secondChild}
          </MyResize>
        </div>
      );
    case Layout.terminal:
      return (
        <div className={className} style={{ alignItems: 'stretch' }}>
          <div key={0} ref={firstWrapRef}
            className="expanded"
            style={{
              opacity: 1,
              transition: 'opacity 150ms',
            }}>
            {firstChild}
          </div>
          <MyPlaceholder
            initLength={lastLayout === Layout.terminal ? 0 : length}
            length={layout === Layout.terminal ? 0 : length}
            axis={axis}
            onTransitionEnd={syncLayout} />
        </div>
      );
    case Layout.fileExplorer:
      return (
        <div className={className} style={{ alignItems: 'stretch' }}>
          <MyPlaceholder
            initLength={lastLayout === Layout.fileExplorer ? 0 : sizeLength - length}
            length={layout === Layout.fileExplorer ? 0 : sizeLength - length}
            axis={axis}
            onTransitionEnd={syncLayout} />
          <MyResize key={1}
            divRef={secondWrapRef}
            length={length}
            setLength={setLength}
            axis={null}
            style={{
              opacity: 1,
              transition: 'opacity 150ms',
            }}>
            {secondChild}
          </MyResize>
        </div>
      );
  }
}

function MyResize({ children, axis, divRef, length, setLength, style, onTransitionEnd }: {
  children: React.ReactNode,
  axis: 'x' | 'y' | null,
  divRef?: React.LegacyRef<HTMLDivElement>,
  length: number,
  setLength: React.Dispatch<React.SetStateAction<number>>,
  style?: React.CSSProperties,
  onTransitionEnd?: React.TransitionEventHandler<HTMLDivElement>,
}) {
  const [enable, setEnable] = React.useState(0);
  const startDrag = enable > 0;
  React.useEffect(() => {
    const onUp = () => setEnable(v => Math.max(v - 1, 0));
    window.addEventListener('mouseup', onUp, { passive: true });
    return () => {
      window.removeEventListener('mouseup', onUp);
    }
  });
  React.useEffect(() => {
    if (startDrag) {
      const onMove = axis === 'x' ?
        (e: Event) => {
          e.preventDefault();
          setLength(width => Math.max(width - (e as MouseEvent).movementX, 300));
        } :
        (e: Event) => {
          e.preventDefault();
          setLength(height => Math.max(height - (e as MouseEvent).movementY, 300));
        };
      window.addEventListener('mousemove', onMove);
      return () => {
        window.removeEventListener('mousemove', onMove);
      }
    }
  }, [axis, setLength, startDrag]);

  if (axis === null) {
    return (
      <div className="expanded" style={style}
        ref={divRef}
        onTransitionEnd={onTransitionEnd}>
        {children}
      </div>
    );
  }

  const [d0, d1]: [React.CSSProperties, React.CSSProperties] = axis === 'x' ? [
    { position: 'relative', height: '100%', width: length },
    { position: 'absolute', height: '100%', width: 8, left: 0, top: 0, cursor: 'ew-resize' },
  ] : [
    { position: 'relative', height: length, width: '100%' },
    { position: 'absolute', height: 8, width: '100%', left: 0, top: 0, cursor: 'ns-resize' },
  ];
  return (
    <div style={{ ...d0, ...style }}
      ref={divRef}
      onTransitionEnd={onTransitionEnd}>
      {children}
      <div style={d1}
        onMouseDown={(e) => {
          e.preventDefault();
          setEnable(v => v + 1);
        }}></div>
    </div>
  );
}

function MyPlaceholder({ initLength, length, axis, onTransitionEnd }: {
  initLength: number,
  length: number,
  axis: 'x' | 'y',
  onTransitionEnd: React.TransitionEventHandler<HTMLDivElement>,
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [mergeLength, setMergeLength] = React.useState(initLength);
  React.useEffect(() => {
    ref.current?.getBoundingClientRect();
    setMergeLength(length);
  }, [length]);
  const style: React.CSSProperties = axis === 'x' ?
    {
      width: mergeLength,
      transition: 'width 200ms ease',
      willChange: 'width',
    } :
    {
      height: mergeLength,
      transition: 'height 200ms ease',
      willChange: 'height',
    };
  return <div ref={ref} style={style}
    onTransitionEnd={e => {
      if (e.target === ref.current) onTransitionEnd(e);
    }} />;
}

