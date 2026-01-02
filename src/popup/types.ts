export type StatusState = 'idle' | 'error' | 'ready';

export type SetStatus = (message: string, state?: StatusState) => void;
