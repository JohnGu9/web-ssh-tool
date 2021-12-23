import React from "react";

class LayoutBuilder extends React.Component<LayoutBuilder.Props, LayoutBuilder.State> {
  constructor(props: LayoutBuilder.Props) {
    super(props);
    this.state = {};
    this._ref = React.createRef();
  }

  readonly _ref: React.RefObject<HTMLDivElement>;
  readonly _resize = () => {
    const { current } = this._ref;
    if (current) this.setState({ size: { height: current.clientHeight, width: current.clientWidth } })
  }

  override componentDidMount() {
    this._resize();
    window.addEventListener('resize', this._resize);
  }

  override componentWillUnmount() {
    window.removeEventListener('resize', this._resize);
  }

  override render() {
    return (
      <div key={null} ref={this._ref} style={this.props.style} className={this.props.className}>
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
