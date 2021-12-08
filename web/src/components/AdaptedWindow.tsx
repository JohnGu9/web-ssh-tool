import React, { ComponentType } from 'react';
import * as Window from 'react-window';
import { ListChildComponentProps } from 'react-window';
import LayoutBuilder from './LayoutBuilder';
import './AdaptedWindow.css';

export namespace FixedSizeList {
  export type ListRefType = Window.FixedSizeList;
  export type Props = {
    itemCount: number,
    itemSize: number,
    children: ComponentType<ListChildComponentProps>,
    style?: React.CSSProperties,
    className?: string,
    listRef?: React.RefObject<ListRefType>,
  };
}

export function FixedSizeList({ itemCount, itemSize, children, listRef, className, style }: FixedSizeList.Props) {
  return <LayoutBuilder className={`fixed-size-list ${className}`} style={style}
    builder={(size, _) => {
      const { height, width } = size ?? { height: 0, width: 0 };
      return <Window.FixedSizeList
        ref={listRef}
        height={height}
        width={width}
        itemCount={itemCount}
        itemSize={itemSize}
      >{children}</Window.FixedSizeList>
    }}></LayoutBuilder>;
}