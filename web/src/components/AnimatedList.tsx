import React from "react";
import AnimateHeight from "react-animate-height";

class AnimatedList extends React.Component<AnimatedList.Props> {
  constructor(props: AnimatedList.Props) {
    super(props);
    this._children = new Map(props.children
      .map(value => [value.listId, value.children]));
    this._origin = new Set(this._children.keys())
  }

  protected _children: Map<AnimatedList.KeyType, React.ReactNode>;
  protected _origin: Set<AnimatedList.KeyType>;

  override componentDidUpdate(oldProps: AnimatedList.Props) {
    if (oldProps.children !== this.props.children) {
      this._origin.clear();
      for (const { listId, children } of this.props.children) {
        this._children.set(listId, children);
      }
      this.forceUpdate();
    }
  }

  override render() {
    const newKeys = new Set(this.props.children
      .map(value => value.listId));
    return (<>
      {Array.from(this._children.entries())
        .map(value => {
          const [listId, children] = value;
          return (
            <Wrap
              key={listId}
              duration={this.props.duration ?? 300}
              isOrigin={this._origin.has(listId)}
              isExisted={newKeys.has(listId)}
              onExit={() => this.setState(() => {
                this._children.delete(listId);
                return {};
              })}>
              {children}
            </Wrap>
          )
        })}
    </>
    );
  }
}

export default AnimatedList;

namespace AnimatedList {
  export type KeyType = any;
  export type Props = {
    children: { listId: KeyType, children: React.ReactNode }[],
    duration?: number,
  };

  export const enum AnimationState {
    enter, entering, entered, exit,
  }

  type Type = { state: AnimationState, duration: number };
  export const Context = React.createContext<Type>(undefined as unknown as Type);

  export function Wrap(props: {
    children: React.ReactNode,
    style?: React.CSSProperties,
    className?: string,
  }) {
    const { style, className } = props;
    const { state, duration } = React.useContext(AnimatedList.Context);
    return <AnimateHeight
      style={style}
      className={className}
      height={(() => {
        switch (state) {
          case AnimationState.enter:
          case AnimationState.exit:
            return 0;
          default:
            return 'auto';
        }
      })()} duration={duration}>
      {props.children}
    </AnimateHeight>;
  }
}

class Wrap extends React.Component<Wrap.Props, Wrap.State> {
  constructor(props: Wrap.Props) {
    super(props);
    this.state = { state: props.isOrigin ? AnimatedList.AnimationState.entered : AnimatedList.AnimationState.enter };
  }

  _timer?: number;

  override componentDidMount() {
    if (this.state.state === AnimatedList.AnimationState.enter)
      this.setState({ state: AnimatedList.AnimationState.entering },
        () => this._timer = window.setTimeout(
          () => this.setState({ state: AnimatedList.AnimationState.entered }), this.props.duration));
  }

  override componentDidUpdate(oldProps: Wrap.Props) {
    if (oldProps.isExisted !== this.props.isExisted) {
      window.clearTimeout(this._timer);
      if (this.props.isExisted === false) {
        this.setState({ state: AnimatedList.AnimationState.exit });
        this._timer = window.setTimeout(
          () => this.props.onExit(),
          this.props.duration);
      } else {
        this.setState({ state: AnimatedList.AnimationState.entering },
          () => this._timer = window.setTimeout(
            () => this.setState({ state: AnimatedList.AnimationState.entered }),
            this.props.duration));
      }
    }
  }

  override componentWillUnmount() {
    window.clearTimeout(this._timer);
  }

  override render() {
    return (
      <AnimatedList.Context.Provider value={{ state: this.state.state, duration: this.props.duration }}>
        {this.props.children}
      </AnimatedList.Context.Provider>
    );
  }
}

namespace Wrap {
  export type Props = {
    children: React.ReactNode,
    duration: number,
    isOrigin: boolean,
    isExisted: boolean,
    onExit: () => void,
  };

  export type State = {
    state: AnimatedList.AnimationState
  };
}
