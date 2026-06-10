/// <reference types="vite/client" />

/** Vite asset suffix imports (worker URLs etc.). */
declare module '*?url' {
  const url: string;
  export default url;
}

/** Bridge exposed by the preload script (see src/preload/index.ts). */
interface VikingsBridge {
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;
  on(channel: string, listener: (payload: unknown) => void): () => void;
  platform: string;
}

interface Window {
  vikings: VikingsBridge;
}
