// The HTML build loads React 18 from cdnjs as a global; this module re-exports it for bundled code.
const R = window.React;
export default R;
export const { Children, Component, Fragment, StrictMode, Suspense, createContext, createElement, forwardRef, isValidElement, lazy, memo, startTransition, useCallback, useContext, useDebugValue, useDeferredValue, useEffect, useId, useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, useTransition } = R;
