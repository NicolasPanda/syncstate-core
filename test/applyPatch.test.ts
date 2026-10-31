import { applyPatches, enablePatches } from 'immer';
import { createDocStore } from '../src';
import applyPatch from '../src/utils/applyPatch';
import jsonPatchPathToImmerPath from '../src/utils/jsonPatchPathToImmerPath';

enablePatches();

const doc = () => ({
  count: 1,
  empty: null,
  user: { name: 'Ann', tags: ['a', 'b', 'c'] },
  cards: [
    { _id: 'one', values: { x: 1 } },
    { _id: 'two', values: { x: 2 } },
    { _id: 'three', values: { x: 3 } },
  ],
  'with/slash': { kept: true },
});

const withImmer = (state: any, patch: any) =>
  applyPatches(state, [{ ...patch, path: jsonPatchPathToImmerPath(patch.path) }]);

describe('applyPatch', () => {
  it.each([
    [{ op: 'replace', path: '/count', value: 2 }],
    [{ op: 'replace', path: '/user/name', value: 'Bob' }],
    [{ op: 'replace', path: '/user', value: { name: 'Cid' } }],
    [{ op: 'replace', path: '/cards/1/values/x', value: 20 }],
    [{ op: 'replace', path: '/cards/1', value: { _id: 'new' } }],
    [{ op: 'replace', path: '/cards/length', value: 1 }],
    [{ op: 'replace', path: '/user/tags/length', value: 0 }],
    [{ op: 'replace', path: '/cards/7', value: { _id: 'far' } }],
    [{ op: 'replace', path: '/absent', value: 1 }],
    [{ op: 'add', path: '/user/age', value: 30 }],
    [{ op: 'add', path: '/cards/1', value: { _id: 'inserted' } }],
    [{ op: 'add', path: '/cards/3', value: { _id: 'last' } }],
    [{ op: 'remove', path: '/cards/0' }],
    [{ op: 'remove', path: '/cards/2' }],
    [{ op: 'remove', path: '/user/name' }],
    [{ op: 'remove', path: '/absent' }],
    [{ op: 'replace', path: '/with\\/slash/kept', value: false }],
    [{ op: 'replace', path: '', value: { whole: 'new' } }],
  ])('gives what immer gives for %j', patch => {
    expect(applyPatch(doc(), patch)).toEqual(withImmer(doc(), patch));
  });

  it.each([
    [{ op: 'replace', path: '/absent/deep', value: 1 }],
    [{ op: 'replace', path: '/count/deep', value: 1 }],
    [{ op: 'replace', path: '/empty/deep', value: 1 }],
    [{ op: 'replace', path: '/cards/9/values/x', value: 1 }],
    [{ op: 'replace', path: '/cards/notAnIndex/x', value: 1 }],
    [{ op: 'replace', path: '/cards/notAnIndex', value: 1 }],
    [{ op: 'unknown', path: '/count', value: 1 }],
  ])('refuses %j, which a copy gone out of step relies on', patch => {
    expect(() => applyPatch(doc(), patch)).toThrow();
  });

  it('leaves the document it was given as it was', () => {
    const before = doc();
    applyPatch(before, { op: 'replace', path: '/cards/1/values/x', value: 20 });
    expect(before).toEqual(doc());
  });

  it('shares everything off the path', () => {
    const before = doc();
    const after = applyPatch(before, {
      op: 'replace',
      path: '/cards/1/values/x',
      value: 20,
    });
    expect(after.user).toBe(before.user);
    expect(after.cards[0]).toBe(before.cards[0]);
    expect(after.cards[2]).toBe(before.cards[2]);
    expect(after.cards[1]).not.toBe(before.cards[1]);
  });

  it('puts the value in as given: a list written whole keeps its items', () => {
    const before = doc();
    const kept = before.cards.slice(1);
    const after = applyPatch(before, {
      op: 'replace',
      path: '/cards',
      value: kept,
    });
    expect(after.cards).toBe(kept);
    expect(after.cards[0]).toBe(before.cards[1]);
  });

  it.each([
    [{ op: 'replace', path: '/count', value: 1 }],
    [{ op: 'replace', path: '/cards/1/values/x', value: 2 }],
    [{ op: 'remove', path: '/absent' }],
  ])('answers the same document when %j changes nothing', patch => {
    const before = doc();
    expect(applyPatch(before, patch)).toBe(before);
  });
});

describe('a store write', () => {
  const twoLists = () => ({
    first: [{ _id: 'a', deep: { n: 1 } }],
    second: [{ _id: 'b', deep: { n: 2 } }],
    last: 0,
  });

  it('keeps the identity of everything it did not write', () => {
    const store = createDocStore(twoLists(), [], { maxPatches: 0 });
    const first = store.getStateAtPath('doc', '/first');
    const [, setLast] = store.useSyncState('doc', '/last');

    setLast(1);

    expect(store.getStateAtPath('doc', '/first')).toBe(first);
    expect(store.getStateAtPath('doc', '/last')).toBe(1);
  });

  it('keeps the items of a list written whole', () => {
    const store = createDocStore(twoLists(), [], { maxPatches: 0 });
    const [items, setItems] = store.useSyncState('doc', '/first');
    const next = [...items, { _id: 'c', deep: { n: 3 } }];

    setItems(next, 'remote');

    const written = store.getStateAtPath('doc', '/first');
    expect(written).toHaveLength(2);
    expect(written[0]).toBe(items[0]);
  });

  it('applies what a callback does to its draft', () => {
    const store = createDocStore(twoLists(), [], { maxPatches: 0 });
    const [, setItems] = store.useSyncState('doc', '/second');

    setItems((list: any) => {
      list[0].deep.n = 9;
      list.push({ _id: 'c' });
    });

    expect(store.getStateAtPath('doc', '/second')).toEqual([
      { _id: 'b', deep: { n: 9 } },
      { _id: 'c' },
    ]);
  });

  it('throws on a dispatched patch whose path does not resolve', () => {
    const store = createDocStore(twoLists(), [], { maxPatches: 0 });
    expect(() =>
      store.dispatch({
        type: 'PATCH',
        payload: {
          subtree: 'doc',
          patch: { op: 'replace', path: '/first/5/deep/n', value: 1 },
          origin: 'remote',
        },
      })
    ).toThrow();
  });
});
