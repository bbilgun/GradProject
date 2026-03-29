import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

/**
 * Returns the current AppState and fires a callback when it changes.
 * Useful for pausing/resuming timers or refreshing data on foreground.
 */
export function useAppState(onChange?: (state: AppStateStatus) => void) {
  const [appState, setAppState] = useState(AppState.currentState);
  const savedCallback = useRef(onChange);

  useEffect(() => {
    savedCallback.current = onChange;
  });

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState);
      savedCallback.current?.(nextState);
    });
    return () => subscription.remove();
  }, []);

  return appState;
}
