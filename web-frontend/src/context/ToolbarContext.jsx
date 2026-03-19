import { createContext, useCallback, useContext, useState } from "react";

export const ToolbarContext = createContext(null);

export function ToolbarProvider({ children }) {
  const [toolbarContent, setToolbarContent] = useState(null);

  const registerToolbar = useCallback((content) => {
    setToolbarContent(content ?? null);
  }, []);

  return (
    <ToolbarContext.Provider value={{ toolbarContent, registerToolbar }}>
      {children}
    </ToolbarContext.Provider>
  );
}

export function useToolbar() {
  return useContext(ToolbarContext);
}
