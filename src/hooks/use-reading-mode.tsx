import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type ReadingMode = "normal" | "large";

interface ReadingModeContextType {
  mode: ReadingMode;
  toggle: () => void;
  setMode: (m: ReadingMode) => void;
}

const ReadingModeContext = createContext<ReadingModeContextType>({
  mode: "normal",
  toggle: () => {},
  setMode: () => {},
});

export function ReadingModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ReadingMode>("normal");

  useEffect(() => {
    const saved = localStorage.getItem("fbh-reading-mode") as ReadingMode | null;
    if (saved === "large" || saved === "normal") {
      setModeState(saved);
      document.documentElement.classList.toggle("reading-large", saved === "large");
    }
  }, []);

  const setMode = (m: ReadingMode) => {
    setModeState(m);
    localStorage.setItem("fbh-reading-mode", m);
    document.documentElement.classList.toggle("reading-large", m === "large");
  };

  const toggle = () => setMode(mode === "normal" ? "large" : "normal");

  return (
    <ReadingModeContext.Provider value={{ mode, toggle, setMode }}>
      {children}
    </ReadingModeContext.Provider>
  );
}

export function useReadingMode() {
  return useContext(ReadingModeContext);
}
