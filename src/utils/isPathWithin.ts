/**
 * Whether `path` is `ancestor` itself or lies below it, compared segment by
 * segment: "/cards/1" contains "/cards/1/name" but not "/cards/10", and "/ctas"
 * does not contain "/ctasCategories". The empty path is the root and contains
 * every path.
 *
 * A slash escaped inside a key ("\/") stays part of that key: "/a" does not
 * contain "/a\/b".
 */
export default function isPathWithin(path: string, ancestor: string): boolean {
  if (!ancestor) return true;
  if (path === ancestor) return true;
  const prefix = ancestor.endsWith('/') ? ancestor : ancestor + '/';
  return path.startsWith(prefix);
}
