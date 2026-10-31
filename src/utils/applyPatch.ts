import jsonPatchPathToImmerPath from './jsonPatchPathToImmerPath';

const unresolved = (path: Array<string>) =>
  new Error(`Cannot apply patch, path doesn't resolve: ${path.join('/')}`);

// What a list accepts as a key, as immer's array drafts do.
const isListKey = (key: string) => key === 'length' || !isNaN(parseInt(key));

const writeAt = (container: any, key: string, patch: any, path: Array<string>) => {
  const list = Array.isArray(container);
  switch (patch.op) {
    case 'replace': {
      if (list && !isListKey(key)) throw unresolved(path);
      if (container[key] === patch.value && key in container) return container;
      const copy = list ? container.slice() : { ...container };
      copy[key] = patch.value;
      return copy;
    }
    case 'add': {
      if (list) {
        const copy = container.slice();
        copy.splice(key as any, 0, patch.value);
        return copy;
      }
      if (container[key] === patch.value && key in container) return container;
      return { ...container, [key]: patch.value };
    }
    case 'remove': {
      if (list) {
        const copy = container.slice();
        copy.splice(key as any, 1);
        return copy;
      }
      if (!(key in container)) return container;
      const copy = { ...container };
      delete copy[key];
      return copy;
    }
    default:
      throw new Error(`Unsupported patch operation: ${patch.op}`);
  }
};

const write = (
  container: any,
  path: Array<string>,
  depth: number,
  patch: any
): any => {
  if (typeof container !== 'object' || container === null) {
    throw unresolved(path);
  }
  const key = path[depth];
  if (depth === path.length - 1) return writeAt(container, key, patch, path);

  const child = write(container[key], path, depth + 1, patch);
  if (child === container[key]) return container;
  const copy = Array.isArray(container) ? container.slice() : { ...container };
  copy[key] = child;
  return copy;
};

/**
 * One JSON patch applied to a document, the document left as it is: only the
 * lists and objects on the patch's path are copied (shallowly), everything else
 * is shared with the new document, and the value goes in as given.
 *
 * Same results as immer's applyPatches, which this replaces in the store's
 * reducer, without its two costs on a large document: it deep-clones the value
 * of every patch, so a list written whole came back with every item a new
 * object; and, in a minified build, where immer no longer freezes what it
 * produces, finalizing the draft walks everything not frozen that comes before
 * the path written.
 *
 * @param doc - the document
 * @param patch - { op: 'replace' | 'add' | 'remove', path, value }, the path as
 *   a JSON pointer
 * @returns the new document; the same one when the patch changes nothing
 * @throws when the path does not resolve
 */
export default function applyPatch(doc: any, patch: any) {
  const path = jsonPatchPathToImmerPath(patch.path);
  if (path.length === 0) {
    if (patch.op !== 'replace') {
      throw new Error(`Cannot ${patch.op} the root of a document`);
    }
    return patch.value;
  }
  return write(doc, path, 0, patch);
}
