import React from "react";
import { Button, ButtonProps, IconButton, IconButtonProps, Tooltip } from "rmwc";

function LongPressButton(props: {
  onLongPress: () => unknown,
  onLongPressStart?: () => unknown,
  onLongPressEnd?: () => unknown,
  timeout?: number,
  tooltip?: string,
} & ButtonProps & React.HTMLProps<HTMLElement>) {
  const [tooltipOn, setTooltipOn] = React.useState(false);
  const [down, setDown] = React.useState<number | undefined>(undefined);
  const { onLongPress, onLongPressStart, onLongPressEnd, timeout, tooltip, ...copyProps } = props;
  const clear = () => {
    window.clearTimeout(down);
    setDown(undefined);
    setTooltipOn(false);
    onLongPressEnd?.();
  }
  return (
    <Tooltip content={tooltip ?? 'Please long press'} open={tooltipOn}>
      {React.cloneElement(<Button
        onMouseDown={() => {
          setTooltipOn(true);
          onLongPressStart?.();
          const id = window.setTimeout(onLongPress, timeout ?? 1000);
          setDown(id);
        }}
        onMouseUp={clear}
        onMouseLeave={clear} />, copyProps)}
    </Tooltip>
  );
}

export default LongPressButton;


export function LongPressIconButton(props: {
  onLongPress: () => unknown,
  onLongPressStart?: () => unknown,
  onLongPressEnd?: () => unknown,
  timeout?: number,
  tooltip?: string,
} & IconButtonProps & React.HTMLProps<HTMLElement>) {
  const [tooltipOn, setTooltipOn] = React.useState(false);
  const [down, setDown] = React.useState<number | undefined>(undefined);
  const { onLongPress, onLongPressStart, onLongPressEnd, timeout, tooltip, ...copyProps } = props;
  const clear = () => {
    window.clearTimeout(down);
    setDown(undefined);
    setTooltipOn(false);
    onLongPressEnd?.();
  }
  return (
    <Tooltip content={tooltip ?? 'Please long press'} open={tooltipOn}>
      {React.cloneElement(<IconButton
        onMouseDown={() => {
          setTooltipOn(true);
          onLongPressStart?.();
          const id = window.setTimeout(onLongPress, timeout ?? 1000);
          setDown(id);
        }}
        onMouseUp={clear}
        onMouseLeave={clear} />, copyProps)}
    </Tooltip>
  );
}
