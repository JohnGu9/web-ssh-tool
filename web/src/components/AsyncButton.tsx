import React from "react";
import { Button, ButtonProps } from "rmwc";

/**
 * rmwc Button disable on click and enable when async onClick return
 * @param props 
 * @returns 
 */
function AsyncButton(props: {
  onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => Promise<any>,
  style?: React.CSSProperties,
} & ButtonProps) {
  const [disabled, setDisabled] = React.useState(false);
  return <Button
    dense={props.dense}
    raised={props.raised}
    unelevated={props.unelevated}
    outlined={props.outlined}
    danger={props.danger}
    label={props.label}
    icon={props.icon}
    trailingIcon={props.trailingIcon}
    disabled={props.disabled}
    style={{
      ...props.style,
      cursor: props.disabled ? 'progress' : 'auto',
      pointerEvents: disabled || props.disabled ? 'none' : "auto",
      opacity: disabled || props.disabled ? 0.7 : 1,
      transition: 'opacity 300ms'
    }}
    onClick={async event => {
      setDisabled(true);
      await props.onClick(event);
      setDisabled(false);
    }} />
}

export default AsyncButton;
