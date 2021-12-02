import React from "react";
import { SwitchTransition } from "./Transitions";

function FadeCrossTransition({ id, children, style, className }: {
  id: any,
  children: React.ReactNode,
  style?: React.CSSProperties,
  className?: string,
}) {
  return (
    <SwitchTransition id={id} getAnimations={() => ({
      inAnimation: { duration: 90, style: { animation: 'fade-in-transition 90ms' } },
      outAnimation: { duration: 210, style: { opacity: 0, transition: 'opacity 210ms' } },
    })} style={style} className={className}>
      {children}
    </SwitchTransition>
  );
}

export default FadeCrossTransition;