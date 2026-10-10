import { useCallback, useRef, useState } from 'react';

export type SaveError = {
  label: string;
  message: string;
  retry: () => void;
  /** Restores the value shown before the failed change (value edits only). */
  undo?: () => void;
};

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; savedAt: Date }
  | { status: 'error'; error: SaveError };

type Job = { label: string; request: () => Promise<unknown>; undo?: () => void };

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'The change could not be saved.');

/**
 * Save feedback shared by the grid and the inspector: pending, saved time, or
 * the last failure with retry (and undo for values). A failure stays visible
 * until it is retried or undone, even if later saves succeed.
 */
export function useSaveStatus() {
  const [state, setState] = useState<SaveState>({ status: 'idle' });
  const errorRef = useRef<SaveError | null>(null);

  const run = useCallback(async function runJob(job: Job): Promise<boolean> {
    if (!errorRef.current) setState({ status: 'saving' });
    try {
      await job.request();
      if (!errorRef.current) setState({ status: 'saved', savedAt: new Date() });
      return true;
    } catch (error) {
      const failure: SaveError = {
        label: job.label,
        message: messageOf(error),
        retry: () => {
          errorRef.current = null;
          void runJob(job);
        },
        undo: job.undo && (() => {
          errorRef.current = null;
          job.undo!();
          setState({ status: 'idle' });
        }),
      };
      errorRef.current = failure;
      setState({ status: 'error', error: failure });
      return false;
    }
  }, []);

  return { state, run };
}
