import { Stats } from "fs";
import React from "react";

namespace FileExplorer {
  export type Type = {
    cd: (path?: string) => unknown,
    config: Config,
    setConfig: (config: Config) => unknown,
    upload: (file: File, dest: string) => void,
  }
  export const Context = React.createContext<Type>(undefined as unknown as Type);

  export const enum SortType { alphabetically = 'alphabetically', date = 'date', none = 'none' };
  export type Config = { showAll: boolean, sort: SortType };
  export function switchSortType(current: SortType) {
    switch (current) {
      case SortType.alphabetically:
        return SortType.date;
      case SortType.date:
        return SortType.none;
      case SortType.none:
        return SortType.alphabetically;
    }
  }

  function compare<T>(a: T, b: T) {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }
  export function sortArray(array: Array<[string, Stats]>, type: SortType) {
    switch (type) {
      case SortType.none:
        return array;
      case SortType.date:
        return array.sort(([_, stats0], [__, stats1]) => compare(stats0.mtime, stats1.mtime));
      case SortType.alphabetically:
        return array.sort(([key0], [key1]) => compare(key0, key1));
    }
  }

}

export default FileExplorer;

export * from "./common/NavigatorBar";
export * from "./common/GoToDialog";