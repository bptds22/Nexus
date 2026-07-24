"use client";

// components/page-editor/toast.tsx
//
// Toast contextualisé — remplace le `toast(m)` global du mock. Le provider rend
// la pastille (position:fixed) et expose toast() via useToast() aux sections.

import * as React from "react";

type ToastFn = (message: string) => void;

const ToastCtx = React.createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return React.useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = React.useState("");
  const [show, setShow] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);

  const toast = React.useCallback((message: string) => {
    setMsg(message);
    setShow(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShow(false), 2200);
  }, []);

  React.useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className={"pe-toast" + (show ? " show" : "")}>{msg}</div>
    </ToastCtx.Provider>
  );
}
