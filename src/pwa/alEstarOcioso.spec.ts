import { afterEach, describe, expect, it, vi } from 'vitest';

import { alEstarOcioso } from './alEstarOcioso.ts';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('alEstarOcioso (SCRUM-283)', () => {
  it('pide al navegador que avise cuando este libre, con un plazo maximo', () => {
    const requestIdleCallback = vi.fn();
    vi.stubGlobal('requestIdleCallback', requestIdleCallback);
    const tarea = vi.fn();

    alEstarOcioso(tarea, 2_500);

    expect(requestIdleCallback).toHaveBeenCalledWith(tarea, { timeout: 2_500 });
    expect(tarea).not.toHaveBeenCalled();
  });

  it('sin requestIdleCallback (Safari) la hace un momento despues, no antes', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const tarea = vi.fn();

    alEstarOcioso(tarea);

    vi.advanceTimersByTime(999);
    expect(tarea).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(tarea).toHaveBeenCalledTimes(1);
  });
});
