import React from "react";
import { Button, ButtonProps, Tooltip } from "rmwc";

function LongPressButton(props: {
  style?: React.CSSProperties,
  className?: string,
  onLongPress: () => unknown,
  onLongPressStart?: () => unknown,
  onLongPressEnd?: () => unknown,
  timeout?: number,
  tooltip?: string,
} & ButtonProps & React.HTMLProps<HTMLElement>) {
  const [tooltip, setTooltip] = React.useState(false);
  const [down, setDown] = React.useState<number | undefined>(undefined);
  const clear = () => {
    window.clearTimeout(down);
    setDown(undefined);
    setTooltip(false);
    props.onLongPressEnd?.();
  }
  return (
    <Tooltip content={props.tooltip ?? 'Please long press'} open={tooltip}>
      {React.cloneElement(<Button
        onMouseDown={() => {
          setTooltip(true);
          props.onLongPressStart?.();
          const id = window.setTimeout(props.onLongPress, props.timeout ?? 1000);
          setDown(id);
        }}
        onMouseUp={clear}
        onMouseLeave={clear} />, props)}
    </Tooltip>
  );
}

export default LongPressButton;
