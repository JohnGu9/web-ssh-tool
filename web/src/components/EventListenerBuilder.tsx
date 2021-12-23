import React from "react";

class EventListenerBuilder extends React.Component<{
  eventName: string,
  eventTarget: EventTarget,
  builder: () => React.ReactNode,
}> {
  listener = () => this.forceUpdate();

  override componentDidMount() { this.props.eventTarget.addEventListener(this.props.eventName, this.listener) }

  override componentDidUpdate(oldProps: {
    eventName: string,
    eventTarget: EventTarget,
    builder: () => React.ReactNode
  }) {
    if (oldProps.eventName !== this.props.eventName
      || oldProps.eventTarget !== this.props.eventTarget
      || oldProps.builder !== this.props.builder) {
      oldProps.eventTarget.removeEventListener(oldProps.eventName, this.listener);
      this.props.eventTarget.addEventListener(this.props.eventName, this.listener);
      this.forceUpdate();
    }
  }

  override componentWillUnmount() { this.props.eventTarget.removeEventListener(this.props.eventName, this.listener); }

  override render() {
    return this.props.builder();
  }
}

export default EventListenerBuilder;