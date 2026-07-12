"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type TransitionState = "idle" | "exiting" | "navigating";

interface TransitionContextValue {
  state: TransitionState;
  selectedCardId: string | null;
  navigateToDashboard: (href: string, cardId: string) => void;
}

const TransitionContext = createContext<TransitionContextValue>({
  state: "idle",
  selectedCardId: null,
  navigateToDashboard: () => {},
});

export function usePageTransition() {
  return useContext(TransitionContext);
}

export function TransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<TransitionState>("idle");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigateToDashboard = useCallback(
    (href: string, cardId: string) => {
      if (state !== "idle") return;
      setSelectedCardId(cardId);
      setState("exiting");
      timerRef.current = setTimeout(() => {
        setState("navigating");
        router.push(href);
      }, 450);
    },
    [state, router]
  );

  return (
    <TransitionContext.Provider value={{ state, selectedCardId, navigateToDashboard }}>
      {children}
    </TransitionContext.Provider>
  );
}
