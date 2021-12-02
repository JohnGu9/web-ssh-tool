import React from 'react';
import history from 'history/browser';

export type HistoryContextType = typeof history;
export const HistoryContext = React.createContext(history);
