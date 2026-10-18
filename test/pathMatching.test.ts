import { createDocStore } from '../src';
import isPathWithin from '../src/utils/isPathWithin';

describe('isPathWithin', () => {
  it('compares paths segment by segment', () => {
    expect(isPathWithin('/cards/1', '/cards/1')).toBe(true);
    expect(isPathWithin('/cards/1/name', '/cards/1')).toBe(true);
    expect(isPathWithin('/cards/10', '/cards/1')).toBe(false);
    expect(isPathWithin('/cards/100/name', '/cards/1')).toBe(false);
    expect(isPathWithin('/ctasCategories/0', '/ctas')).toBe(false);
    expect(isPathWithin('/a\\/b', '/a')).toBe(false);
  });

  it('treats the empty path as the root', () => {
    expect(isPathWithin('/cards/1', '')).toBe(true);
    expect(isPathWithin('', '')).toBe(true);
    expect(isPathWithin('', '/cards')).toBe(false);
  });
});

describe('observers and interceptors', () => {
  const store = () =>
    createDocStore({
      cards: Array.from({ length: 12 }, (_, i) => ({ name: `card ${i}` })),
      ctas: [{ name: 'module' }],
      ctasCategories: [{ name: 'category' }],
    });

  it('an observer of /cards/1 is not woken by /cards/10', () => {
    const docStore = store();
    const seen: string[] = [];
    docStore.observe(
      'doc',
      '/cards/1',
      (_value: any, change: any) => seen.push(change.patch.path),
      Infinity
    );

    const [, setTen] = docStore.useDoc('/cards/10/name');
    setTen('ten');
    const [, setOne] = docStore.useDoc('/cards/1/name');
    setOne('one');

    expect(seen).toEqual(['/cards/1/name']);
  });

  it('an observer is still woken when a path above it changes', () => {
    const docStore = store();
    const seen: string[] = [];
    docStore.observe(
      'doc',
      '/cards/1/name',
      (_value: any, change: any) => seen.push(change.patch.path),
      Infinity
    );

    const [, setCards] = docStore.useDoc('/cards');
    setCards([{ name: 'a' }, { name: 'b' }]);

    expect(seen).toEqual(['/cards']);
  });

  it('an interceptor of /ctas is not handed /ctasCategories', () => {
    const docStore = store();
    const seen: string[] = [];
    docStore.intercept(
      'doc',
      '/ctas',
      (_value: any, change: any) => {
        seen.push(change.patch.path);
        return change;
      },
      Infinity
    );

    const [, setCategory] = docStore.useDoc('/ctasCategories/0/name');
    setCategory('renamed');
    const [, setModule] = docStore.useDoc('/ctas/0/name');
    setModule('renamed');

    expect(seen).toEqual(['/ctas/0/name']);
  });
});
