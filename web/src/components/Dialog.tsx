import React from 'react';
import * as rmwc from 'rmwc';

export function DialogTitle({ children, ...props }: rmwc.DialogTitleProps & React.HTMLProps<HTMLElement>) {
  return (
    <rmwc.DialogTitle {...props}>
      <rmwc.Theme use='onSurface'>
        {children}
      </rmwc.Theme>
    </rmwc.DialogTitle>
  );
}

export function DialogContent({ children, ...props }: rmwc.DialogContentProps & React.HTMLProps<HTMLElement>) {
  return (
    <rmwc.DialogContent {...props}>
      <rmwc.Theme use='onSurface'>
        {children}
      </rmwc.Theme>
    </rmwc.DialogContent>
  );
}