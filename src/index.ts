import {
  produce,
  applyPatches,
  produceWithPatches,
  enablePatches,
} from 'immer';
import immerPathToJsonPatchPath from './utils/immerPathToJsonPatchPath';

import DocStore from './DocStore';
import jsonPatchPathToImmerPath from './utils/jsonPatchPathToImmerPath';
import { DocStoreOptions } from './types';
enablePatches();

function assertMaxPatches(maxPatches: number) {
  const isCount = Number.isInteger(maxPatches) && maxPatches >= 0;
  if (!isCount && maxPatches !== Infinity) {
    throw new Error(
      `maxPatches must be a whole number of 0 or more, or Infinity: got ${maxPatches}`
    );
  }
}

// Built outside the reducer's draft: reading the old patches through the draft
// would make one proxy per kept patch, on every write.
function appendPatch(patches: Array<any>, entry: any, maxPatches: number) {
  const appended = [...patches, entry];
  return appended.slice(Math.max(0, appended.length - maxPatches));
}

function createTopReducer(maxPatches: number) {
  return function topReducer(state: any, action: any) {
    switch (action.type) {
      case 'PATCH': {
        const { subtree, patch, inversePatch } = action.payload;
        const patches = appendPatch(
          state[subtree].patches,
          { patch, inversePatch },
          maxPatches
        );
        return produce(state, (draftState: any) => {
          draftState[subtree].state = applyPatches(draftState[subtree].state, [
            { ...patch, path: jsonPatchPathToImmerPath(patch.path) },
          ]);
          draftState[subtree].patches = patches;
        });
      }

      case 'CREATE_SUBTREE': {
        return produce(state, (draftState: any) => {
          draftState[action.payload.subtree] = {
            state: action.payload.initialState,
            patches: [],
          };
        });
      }

      default:
        return state;
    }
  };
}

export function createDocStore(
  initialDoc: {},
  plugins?: Array<any>,
  { maxPatches = Infinity }: DocStoreOptions = {}
) {
  assertMaxPatches(maxPatches);
  const docStore = new DocStore(
    initialDoc,
    createTopReducer(maxPatches),
    plugins
  );

  return docStore;
}

export type SyncStatePath = Array<string | number>;
export { DocStore, jsonPatchPathToImmerPath, immerPathToJsonPatchPath };
export * from './types';
