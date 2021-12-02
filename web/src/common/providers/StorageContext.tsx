import React from "react";

export type StorageContextType = {
  localStorage: Storage,
  sessionStorage: Storage,
}

export const StorageContext = React.createContext<StorageContextType>({
  localStorage: localStorage,
  sessionStorage: sessionStorage
});
