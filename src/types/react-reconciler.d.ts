declare module "react-reconciler" {
  type HostConfig = Record<string, unknown>;
  type Reconciler = {
    createContainer: (
      containerInfo: unknown,
      tag: number,
      hydrationCallbacks: null,
      isStrictMode: boolean,
      concurrentUpdatesByDefaultOverride: null,
      identifierPrefix: string,
      onUncaughtError: (error: unknown) => void,
      onCaughtError: (error: unknown) => void,
      onRecoverableError: (error: unknown) => void,
      onDefaultTransitionIndicator: null,
    ) => unknown;
    updateContainer: (element: unknown, container: unknown, parentComponent: null, callback: null) => void;
    updateContainerSync: (element: unknown, container: unknown, parentComponent: null, callback: null) => void;
    flushSyncWork: () => void;
  };
  export default function reactReconciler(config: HostConfig): Reconciler;
}
