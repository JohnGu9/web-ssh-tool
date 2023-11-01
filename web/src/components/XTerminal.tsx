import 'xterm/css/xterm.css';
import './Layout.css'

import React from "react";
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import LayoutBuilder from "./LayoutBuilder";

class XTerminal extends React.Component<XTerminal.Props> {
  protected readonly _ref: React.RefObject<HTMLDivElement> = React.createRef();
  protected _fit!: FitAddon;
  protected fit = () => {
    this._fit.fit();
    const { onResize, terminal } = this.props;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { clientHeight, clientWidth } = this._ref.current!;
    onResize?.({ height: clientHeight, width: clientWidth, cols: terminal.cols, rows: terminal.rows });
  }

  override componentDidMount() {
    this._fit = new FitAddon();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const current = this._ref.current!;
    this.props.terminal.loadAddon(this._fit);
    this.props.terminal.open(current);
    this.props.terminal.focus();
  }

  override componentDidUpdate(oldProps: XTerminal.Props) {
    if (oldProps.terminal !== this.props.terminal) {
      this._fit.dispose();
      this._fit = new FitAddon();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const current = this._ref.current!;
      this.props.terminal.loadAddon(this._fit);
      this.props.terminal.open(current);
      this.props.terminal.focus();
    }
  }

  override componentWillUnmount() {
    this._fit.dispose();
  }

  override render() {
    const { style, className } = this.props;
    return <LayoutBuilder
      style={style}
      className={className}
      builder={() => {
        window.requestAnimationFrame(this.fit);
        return <div ref={this._ref} className='full-size' />;
      }} />;
  }
}

namespace XTerminal {
  export type Props = {
    readonly style?: React.CSSProperties,
    readonly className?: string,
    readonly terminal: Terminal,
    readonly onResize?: (resize: { rows: number, cols: number, height: number, width: number }) => unknown,
  };
}

export default XTerminal;
