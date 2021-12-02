import React from "react";
import delay from "../common/Delay";
import { wsSafeClose } from "../common/DomTools";

class WebSocketProvider extends React.Component<WebSocketProvider.Props, WebSocketProvider.State> {
  constructor(props: WebSocketProvider.Props) {
    super(props);
    this.state = {};
  }

  _ws?: WebSocket;
  _mounted = true;

  _bindListener(ws: WebSocket) {
    ws.addEventListener('close', this._onClose);
    ws.addEventListener('error', this._onClose);
    ws.addEventListener('open', this._onOpen);
  }

  _unbindListener(ws: WebSocket) {
    ws.removeEventListener('close', this._onClose);
    ws.removeEventListener('error', this._onClose);
    ws.removeEventListener('open', this._onOpen);
  }

  _onOpen = () => {
    if (this._ws) {
      const { onOpen } = this.props;
      if (onOpen) onOpen(this._ws);
      this.setState({ ws: this._ws });
    }
  }

  _onClose = async () => {
    if (this._ws) {
      this._unbindListener(this._ws);
      wsSafeClose(this._ws);
      this._ws = undefined;
    }
    if (!this._mounted) return;
    this.setState({ ws: this._ws });
    await delay(this.props.interval ?? 3000);
    if (!this._mounted) return;
    this._bindListener(this._ws = new WebSocket(this.props.url));
  }

  componentDidMount() {
    this._bindListener(this._ws = new WebSocket(this.props.url));
  }

  componentWillUnmount() {
    this._mounted = false;
    if (this._ws) {
      this._unbindListener(this._ws);
      wsSafeClose(this._ws);
    }
  }

  render() {
    return this.props.builder(this.state.ws);
  }
}

namespace WebSocketProvider {
  export type Props = {
    url: string,
    interval?: number,
    onOpen?: (ws: WebSocket) => void;
    builder: (ws?: WebSocket) => React.ReactNode,
  };
  export type State = {
    ws?: WebSocket,
  };
}

export default WebSocketProvider;
