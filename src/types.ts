export type Watch = (
  path: string,
  depth?: number,
  firstWatch?: boolean
) => void;

export interface DocStoreOptions {
  /**
   * How many patches each subtree keeps, the oldest dropped first. Every patch
   * holds the values it wrote, so a store that never reads its patches back
   * should set this, or those values live for as long as the page does.
   * Keeps them all when left out.
   */
  maxPatches?: number;
}

export type ComputeCallback = (
  getValue: (path: string, depth?: number, firstRun?: boolean) => any,
  change: any
) => any;
