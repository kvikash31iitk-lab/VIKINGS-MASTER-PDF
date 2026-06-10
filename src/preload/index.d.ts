import type { VikingsBridge } from './index';

declare global {
  interface Window {
    vikings: VikingsBridge;
  }
}

export {};
