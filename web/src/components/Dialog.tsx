import React from 'react';
import * as rmwc from 'rmwc';

export function DialogTitle(props: rmwc.DialogTitleProps & React.HTMLProps<HTMLElement>) {
  return React.cloneElement(
    <rmwc.DialogTitle />,
    {
      ...props,
      children: (
        <rmwc.Theme use='onSurface'>
          {props.children}
        </rmwc.Theme>
      )
    }
  );
}

export function DialogContent(props: rmwc.DialogContentProps & React.HTMLProps<HTMLElement>) {
  return React.cloneElement(
    <rmwc.DialogContent />,
    {
      ...props,
      children: (
        <rmwc.Theme use='onSurface'>
          {props.children}
        </rmwc.Theme>
      )
    }
  );
}