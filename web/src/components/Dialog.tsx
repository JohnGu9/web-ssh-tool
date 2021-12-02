import React from 'react';
import * as rmwc from 'rmwc';

export function DialogTitle({ children, style }: { children: React.ReactNode, style?: React.CSSProperties }) {
  return (
    <rmwc.DialogTitle style={style}>
      <rmwc.Theme use='onSurface'>
        {children}
      </rmwc.Theme>
    </rmwc.DialogTitle>
  );
}

export function DialogContent({ children, style }: { children: React.ReactNode, style?: React.CSSProperties }) {
  return (
    <rmwc.DialogContent style={style}>
      <rmwc.Theme use='onSurface'>
        {children}
      </rmwc.Theme>
    </rmwc.DialogContent>
  );
}