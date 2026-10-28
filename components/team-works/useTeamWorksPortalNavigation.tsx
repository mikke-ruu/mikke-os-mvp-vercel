"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useReducer } from "react";

type Page = { view: string; tab: string; date: string; scroll: number };
type State = { current: Page; history: Page[]; restore: number | null };
type Action = { type: "view"; value: string; scroll: number } | { type: "tab" | "date"; value: string } | { type: "back" };

export function portalNavigationReducer(state: State, action: Action): State {
  if (action.type === "back") {
    const previous = state.history.at(-1);
    return previous ? { current: previous, history: state.history.slice(0, -1), restore: previous.scroll } : state;
  }
  if (action.type === "view") {
    if (state.current.view === action.value) return state;
    return {
      current: { ...state.current, view: action.value, scroll: 0 },
      history: [...state.history, { ...state.current, scroll: action.scroll }].slice(-30),
      restore: 0
    };
  }
  return { ...state, current: { ...state.current, [action.type]: action.value }, restore: null };
}

export function useTeamWorksPortalNavigation<T extends string>(initialTab: T, initialDate: string) {
  const [state, dispatch] = useReducer(portalNavigationReducer, {
    current: { view: "home", tab: initialTab, date: initialDate, scroll: 0 }, history: [], restore: null
  });
  useEffect(() => {
    if (state.restore === null) return;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: state.restore!, behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, [state.current.view, state.restore]);
  return {
    activeView: state.current.view, projectTab: state.current.tab as T, selectedDate: state.current.date,
    setActiveView: (value: string) => dispatch({ type: "view", value, scroll: window.scrollY }),
    setProjectTab: (value: T) => dispatch({ type: "tab", value }),
    setSelectedDate: (value: string) => dispatch({ type: "date", value }),
    backButton: state.history.length ? <button type="button" aria-label="前の画面へ戻る" title="前の画面へ戻る" onClick={() => dispatch({ type: "back" })} className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-[var(--mikke-line)] bg-white text-[var(--mikke-primary)]"><ArrowLeft size={20} /></button> : null
  };
}
