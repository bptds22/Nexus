"use client";

// components/page-editor/toast.tsx
//
// Toast contextualisé — remplace le `toast(m)` global du mock. Le provider rend
// la pastille (position:fixed) et expose toast() via useToast() aux sections.

import * as React from "react";

/** `kind` est OPTIONNEL — les dizaines d'appels `toast("…")` existants
 *  restent valides et neutres. Seuls les échecs passent "error". */
type ToastKind = "info" | "error";
type ToastFn = (message: string, kind?: ToastKind) => void;

const ToastCtx = React.createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return React.useContext(ToastCtx);
}

/* Un échec reste affiché BEAUCOUP plus longtemps qu'une confirmation.
   2,2 s suffisent pour « Photo téléversée » ; c'est trop court pour lire
   un message d'erreur, et c'est exactement comme ça qu'un échec d'upload
   passe pour un succès aux yeux de l'utilisateur. */
const DUREE_MS: Record<ToastKind, number> = { info: 2200, error: 7000 };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = React.useState("");
  const [kind, setKind] = React.useState<ToastKind>("info");
  const [show, setShow] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);

  const toast = React.useCallback((message: string, k: ToastKind = "info") => {
    setMsg(message);
    setKind(k);
    setShow(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShow(false), DUREE_MS[k]);
  }, []);

  React.useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div
        className={"pe-toast" + (show ? " show" : "") + (kind === "error" ? " error" : "")}
        role={kind === "error" ? "alert" : "status"}
      >
        {msg}
      </div>
    </ToastCtx.Provider>
  );
}
