import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toggleDebugOverlay } from "@/store/slices/connectionSlice";

const isFocusableElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
};

export function useDebugToggle(): boolean {
  const dispatch = useAppDispatch();
  const debugOverlayEnabled = useAppSelector(
    (state) => state.connection.debugOverlayEnabled,
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isFocusableElement(event.target)) {
        return;
      }
      if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
        dispatch(toggleDebugOverlay());
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch]);

  return debugOverlayEnabled;
}
