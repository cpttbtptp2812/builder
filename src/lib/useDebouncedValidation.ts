import { useCallback, useEffect, useRef } from "react";

export type ValidationSnapshot = { ready: boolean; hint: string };

/** 减少办理面板因校验状态频繁 setState 导致的卡顿 */
export function useDebouncedValidation(onChange?: (v: ValidationSnapshot) => void, ms = 100) {
  const last = useRef<ValidationSnapshot | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  return useCallback((ready: boolean, hint: string) => {
    const next = { ready, hint };
    const prev = last.current;
    if (prev && prev.ready === next.ready && prev.hint === next.hint) return;
    if (timer.current != null) window.clearTimeout(timer.current);
    const delay = ready && !prev?.ready ? 0 : ms;
    timer.current = window.setTimeout(() => {
      last.current = next;
      onChangeRef.current?.(next);
    }, delay);
  }, [ms]);
}
