import React from "react";
import { Button, ButtonHTMLProps, ButtonProps, IconButton, IconButtonProps, Tooltip } from "rmwc";

function LongPressButton({ onLongPress, onLongPressStart, onLongPressEnd, timeout, tooltip, ...props }: {
  onLongPress: () => unknown,
  onLongPressStart?: () => unknown,
  onLongPressEnd?: () => unknown,
  timeout?: number,
  tooltip?: string,
} & ButtonProps & ButtonHTMLProps) {
  const [tooltipOn, setTooltipOn] = React.useState(false);
  const [down, setDown] = React.useState<number | undefined>(undefined);
  const clear = () => {
    window.clearTimeout(down);
    setDown(undefined);
    setTooltipOn(false);
    onLongPressEnd?.();
  }
  return (
    <Tooltip content={tooltip ?? 'Please long press'} open={tooltipOn}>
      <Button {...props}
        onMouseDown={() => {
          setTooltipOn(true);
          onLongPressStart?.();
          const id = window.setTimeout(onLongPress, timeout ?? 1000);
          setDown(id);
        }}
        onMouseUp={clear}
        onMouseLeave={clear} />
    </Tooltip>
  );
}

export default LongPressButton;


export function LongPressIconButton({ onLongPress, onLongPressStart, onLongPressEnd, timeout, tooltip, ...props }: {
  onLongPress: () => unknown,
  onLongPressStart?: () => unknown,
  onLongPressEnd?: () => unknown,
  timeout?: number,
  tooltip?: string,
} & IconButtonProps & ButtonHTMLProps) {
  const [tooltipOn, setTooltipOn] = React.useState(false);
  const [down, setDown] = React.useState<number | undefined>(undefined);
  const clear = () => {
    window.clearTimeout(down);
    setDown(undefined);
    setTooltipOn(false);
    onLongPressEnd?.();
  }
  return (
    <Tooltip content={tooltip ?? 'Please long press'} open={tooltipOn}>
      <IconButton {...props}
        onMouseDown={() => {
          setTooltipOn(true);
          onLongPressStart?.();
          const id = window.setTimeout(onLongPress, timeout ?? 1000);
          setDown(id);
        }}
        onMouseUp={clear}
        onMouseLeave={clear} />
    </Tooltip>
  );
}
