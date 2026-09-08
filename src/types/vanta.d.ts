declare module 'three';

declare module 'vanta/dist/vanta.clouds.min' {
  interface VantaCloudsOptions {
    el: HTMLElement;
    THREE: unknown;
    backgroundColor?: number;
    skyColor?: number;
    cloudColor?: number;
    cloudShadowColor?: number;
    sunColor?: number;
    sunGlareColor?: number;
    sunlightColor?: number;
    speed?: number;
    scale?: number;
    scaleMobile?: number;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
  }

  interface VantaCloudsInstance {
    destroy: () => void;
    resize: () => void;
    animationLoop: () => void;
    req?: number;
  }

  export default function createVantaClouds(options: VantaCloudsOptions): VantaCloudsInstance;
}
