import { createDocStore } from '../src';

const write = (store: any, count: number, start = 0) => {
  const [, setCount] = store.useSyncState('doc', '/count');
  for (let i = start; i < start + count; i++) {
    setCount(i);
  }
};

const counts = (store: any) =>
  store.getPatches('doc').map(({ patch }: any) => patch.value);

describe('maxPatches', () => {
  it('keeps every patch when left out', () => {
    const store = createDocStore({ count: -1 });

    write(store, 5);

    expect(counts(store)).toEqual([0, 1, 2, 3, 4]);
  });

  it('keeps the latest patches and drops the oldest first', () => {
    const store = createDocStore({ count: -1 }, [], { maxPatches: 3 });

    write(store, 5);

    expect(counts(store)).toEqual([2, 3, 4]);
  });

  it('keeps the inverse of each patch it keeps', () => {
    const store = createDocStore({ count: -1 }, [], { maxPatches: 1 });

    write(store, 2);

    const [{ inversePatch }] = store.getPatches('doc');
    expect(inversePatch.value).toBe(0);
  });

  it('keeps none at 0, and still writes the document', () => {
    const store = createDocStore({ count: -1 }, [], { maxPatches: 0 });

    write(store, 3);

    expect(store.getPatches('doc')).toEqual([]);
    expect(store.getStateAtPath('doc', '/count')).toBe(2);
  });

  it('still tells observers about a write it does not keep', () => {
    const store = createDocStore({ count: -1 }, [], { maxPatches: 0 });
    const seen: Array<number> = [];
    store.observe('doc', '/count', (value: number) => seen.push(value), 1);

    write(store, 2);

    expect(seen).toEqual([0, 1]);
  });

  it('counts each subtree on its own', () => {
    const plugin = () => ({
      name: 'other',
      initialState: { count: -1 },
      middleware: () => (next: any) => (action: any) => next(action),
    });
    const store = createDocStore({ count: -1 }, [plugin], { maxPatches: 2 });

    write(store, 4);
    const [, setOther] = store.useSyncState('other', '/count');
    setOther(9);

    expect(counts(store)).toEqual([2, 3]);
    expect(store.getPatches('other').map(({ patch }: any) => patch.value)).toEqual(
      [9]
    );
  });

  it.each([-1, 1.5, NaN])('refuses %p', maxPatches => {
    expect(() => createDocStore({}, [], { maxPatches })).toThrow(/maxPatches/);
  });
});
