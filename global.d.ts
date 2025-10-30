declare module '*.svg' {
    const content: string;
    export default content;
}

declare module 'vitest' {
    export const describe: (...args: any[]) => void;
    export const it: (...args: any[]) => void;
    export const expect: (...args: any[]) => any;
    export const beforeEach: (...args: any[]) => void;
    export const afterEach: (...args: any[]) => void;
}
