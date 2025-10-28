import { useEffect, useState, useRef } from 'react';

/**
 * Typed localStorage hook that keeps the value synchronised with storage
 * and optionally sanitises values before storing them.
 */
export function useLocalStorage<T>(
    key: string,
    defaultValue: T,
    sanitizer?: (value: unknown) => T,
): [T, (value: T | ((prev: T) => T)) => void] {
    const sanitizerRef = useRef(sanitizer);

    const readValue = (): T => {
        if (typeof window === 'undefined') {
            return defaultValue;
        }

        try {
            const raw = window.localStorage.getItem(key);
            if (raw === null) return defaultValue;
            const parsed = JSON.parse(raw) as unknown;
            if (sanitizerRef.current) {
                return sanitizerRef.current(parsed);
            }
            return parsed as T;
        } catch (error) {
            console.warn(`useLocalStorage: failed to read key "${key}"`, error);
            return defaultValue;
        }
    };

    const [storedValue, setStoredValue] = useState<T>(readValue);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const initial = readValue();
            setStoredValue(initial);
        } catch (error) {
            console.warn(`useLocalStorage: failed to initialise key "${key}"`, error);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    useEffect(() => {
        sanitizerRef.current = sanitizer;
    }, [sanitizer]);

    const setValue = (value: T | ((prev: T) => T)) => {
        setStoredValue(prev => {
            const nextValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
            if (typeof window !== 'undefined') {
                try {
                    window.localStorage.setItem(key, JSON.stringify(nextValue));
                } catch (error) {
                    console.warn(`useLocalStorage: failed to write key "${key}"`, error);
                }
            }
            return nextValue;
        });
    };

    return [storedValue, setValue];
}
