import React from "react";

class LayoutBuilder extends React.Component<LayoutBuilder.Props, LayoutBuilder.State> {
  constructor(props: LayoutBuilder.Props) {
    super(props);
    this.state = {};
  }

  protected _resizeObserver = ResizeObserver ? new ResizeObserver(entries => this._resize()) : null;
  protected _current: HTMLDivElement | null = null;

  protected readonly _resize = () => {
    const current = this._current;
    if (current !== null) {
      window.requestAnimationFrame(() => {
        if (this.state.size?.height !== current.clientHeight &&
          this.state.size?.width !== current.clientWidth)
          this.setState({ size: { height: current.clientHeight, width: current.clientWidth } });
      });
    }
  }

  protected _updateRef = (ref: HTMLDivElement | null) => {
    if (ref !== this._current) {
      this._current = ref;
      this._resizeObserver?.disconnect();
      if (ref !== null) this._resizeObserver?.observe(ref);
    }
  }

  override componentDidMount() {
    if (this._resizeObserver === null) {
      this._resize();
      window.addEventListener('resize', this._resize);
    }
  }

  override componentWillUnmount() {
    if (this._resizeObserver === null) window.removeEventListener('resize', this._resize);
    else this._resizeObserver.disconnect();
  }

  override render() {
    return (
      <div key={null} ref={this._updateRef} style={this.props.style} className={this.props.className}>
        {this.props.builder(this.state.size, this.props.children)}
      </div>
    );
  }
}

namespace LayoutBuilder {
  export type Size = { height: number, width: number };
  export type Props = {
    style?: React.CSSProperties,
    className?: string,
    children?: React.ReactNode
    builder: (size: Size | undefined, children?: React.ReactNode) => React.ReactNode,
  }
  export type State = { size?: Size };
}

export default LayoutBuilder;
