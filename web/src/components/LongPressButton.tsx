import React from "react";
import { Button, Icon, IconButton, Tooltip } from "rmcw";

function LongPressButton({ onLongPress, onLongPressStart, onLongPressEnd, timeout, tooltip, icon, label, ...props }: {
  onLongPress: () => unknown,
  onLongPressStart?: () => unknown,
  onLongPressEnd?: () => unknown,
  timeout?: number,
  tooltip?: string,
  icon?: string,
  label?: string,
  className?: string,
  style?: React.CSSProperties,
}) {
  const [tooltipOn, setTooltipOn] = React.useState(false);
  const [down, setDown] = React.useState<number | undefined>(undefined);
  const clear = () => {
    window.clearTimeout(down);
    setDown(undefined);
    setTooltipOn(false);
    onLongPressEnd?.();
  }
  return (
    <Tooltip label={tooltip ?? 'Please long press'} open={tooltipOn}>
      <Button {...props}
        label={label}
        leading={icon !== undefined ? <Icon>{icon}</Icon> : undefined}
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


export function LongPressIconButton({ onLongPress, onLongPressStart, onLongPressEnd, timeout, tooltip, icon, ...props }: {
  onLongPress: () => unknown,
  onLongPressStart?: () => unknown,
  onLongPressEnd?: () => unknown,
  timeout?: number,
  tooltip?: string,
  icon: string,
  className?: string,
  style?: React.CSSProperties,
}) {
  const [tooltipOn, setTooltipOn] = React.useState(false);
  const [down, setDown] = React.useState<number | undefined>(undefined);
  const clear = () => {
    window.clearTimeout(down);
    setDown(undefined);
    setTooltipOn(false);
    onLongPressEnd?.();
  }
  return (
    <Tooltip label={tooltip ?? 'Please long press'} open={tooltipOn}>
      <IconButton {...props}
        onMouseDown={() => {
          setTooltipOn(true);
          onLongPressStart?.();
          const id = window.setTimeout(onLongPress, timeout ?? 1000);
          setDown(id);
        }}
        onMouseUp={clear}
        onMouseLeave={clear} >
        <Icon>{icon}</Icon>
      </IconButton>
    </Tooltip>
  );
}
