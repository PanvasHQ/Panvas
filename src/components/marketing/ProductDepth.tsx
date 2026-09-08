import { useEffect, useRef, useState } from 'react';
import type { MotionValue } from 'framer-motion';
// Local adapter for the existing untyped Vanta/Three module declaration.
type Renderer = { setPixelRatio: (n: number) => void; setClearColor: (c: number, a: number) => void; outputColorSpace: unknown; capabilities: { getMaxAnisotropy: () => number }; setSize: (w: number, h: number, update: boolean) => void; render: (s: unknown, c: unknown) => void; dispose: () => void; domElement: HTMLCanvasElement };
type PlaneGroup = { position: { set: (x: number, y: number, z: number) => void }; rotation: { x: number; set: (x: number, y: number, z: number) => void } };

/** Real product textures in a demand-rendered spatial composition. No idle render loop. */
export function ProductDepth({ progress }: { progress: MotionValue<number> }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = host.current;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
    if (!el || matchMedia('(max-width: 899px), (prefers-reduced-motion: reduce)').matches || nav.connection?.saveData || (nav.deviceMemory && nav.deviceMemory < 4)) return;
    let disposed = false, visible = false, pending = 0, loading = false;
    let renderer: Renderer | undefined;
    let renderScene: (() => void) | undefined;
    let pointer = { x: 0, y: 0 };
    const resources: { dispose: () => void }[] = [];
    const request = () => { if (!disposed && visible && !document.hidden && !pending && renderScene) pending = requestAnimationFrame(() => { pending = 0; renderScene?.(); }); };
    const start = async () => {
      if (loading) return; loading = true;
      try {
        const T = await import('three'); if (disposed) return;
        renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }) as Renderer;
        renderer.setPixelRatio(Math.min(devicePixelRatio, navigator.hardwareConcurrency <= 4 ? 1 : 1.25));
        renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = T.SRGBColorSpace;
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(36, 1, .1, 50); camera.position.set(0, -.35, 9.2);
        const group = new T.Group(); scene.add(group);
        scene.add(new T.AmbientLight(0xffffff, 1.8));
        const light = new T.DirectionalLight(0xe4edff, 2); light.position.set(-3, 5, 6); scene.add(light);
        const load = new T.TextureLoader();
        const specs = [
          ['StickyNotes-1280.webp', 4.1, 3.55], ['Voice Notes-1280.webp', 4.5, 3], ['ToolBar-1280.webp', 5.4, .5],
        ] as const;
        const planes: PlaneGroup[] = [];
        await Promise.all(specs.map(async ([file, width, height], index) => {
          const texture = await load.loadAsync('/Application SS updated/optimized/' + file);
          if (disposed) { texture.dispose(); return; }
          texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer!.capabilities.getMaxAnisotropy()); resources.push(texture);
          const geometry = new T.PlaneGeometry(width, height); resources.push(geometry);
          const material = new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: T.DoubleSide }); resources.push(material);
          const plane = new T.Group(); plane.add(new T.Mesh(geometry, material));
          if (index === 2) {
            const edgeGeometry = new T.BoxGeometry(width + .08, height + .08, .075); resources.push(edgeGeometry);
            const edgeMaterial = new T.MeshStandardMaterial({ color: 0xc5d6de, metalness: .35, roughness: .4 }); resources.push(edgeMaterial);
            const edge = new T.Mesh(edgeGeometry, edgeMaterial); edge.position.z = -.055; plane.add(edge);
          }
          group.add(plane); planes[index] = plane;
        }));
        if (disposed) return;
        const resize = () => { if (!renderer) return; const { width, height } = el.getBoundingClientRect(); renderer.setSize(width, height, false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); request(); };
        renderScene = () => {
          const raw = Math.max(0, Math.min(1, (progress.get() - .12) / .76));
          const p = raw * raw * (3 - 2 * raw);
          group.rotation.y += (pointer.x * .09 - group.rotation.y) * .2;
          group.rotation.x += (-pointer.y * .05 - group.rotation.x) * .2;
          planes[0].position.set(-.75 - p * 1.3, .15 + p * .3, -.4 + p * .5);
          planes[0].rotation.set(.08 * (1-p), -.32 * (1-p) - .06, .055 * p);
          planes[1].position.set(.95 + p * 1.4, -.15 - p * .25, .8 - p * .6);
          planes[1].rotation.set(-.08 * (1-p), .34 * (1-p) + .06, -.035 * p);
          planes[2].position.set(0, -1.9 - p * .7, .9); planes[2].rotation.x = .3 * (1-p);
          light.position.x = -3 + pointer.x * 4;
          renderer!.render(scene, camera);
          if (Math.abs(pointer.x * .09 - group.rotation.y) + Math.abs(-pointer.y * .05 - group.rotation.x) > .0003) request();
        };
        el.appendChild(renderer.domElement); resize();
        resizeObserver = new ResizeObserver(resize); resizeObserver.observe(el);
        renderer.domElement.addEventListener('webglcontextlost', onLoss);
        setReady(true); request();
      } catch { renderer?.dispose(); renderer?.domElement.remove(); if (!disposed) setReady(false); }
    };
    let resizeObserver: ResizeObserver | undefined;
    const onLoss = () => { setReady(false); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) { void start(); request(); } else if (pending) { cancelAnimationFrame(pending); pending = 0; } }, { rootMargin: '120px' });
    observer.observe(el);
    const stop = progress.on('change', request);
    const move = (event: PointerEvent) => { if (event.pointerType !== 'mouse') return; const bounds = el.getBoundingClientRect(); pointer = { x: (event.clientX - bounds.left) / bounds.width - .5, y: (event.clientY - bounds.top) / bounds.height - .5 }; request(); };
    const leave = () => { pointer = { x: 0, y: 0 }; request(); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave); document.addEventListener('visibilitychange', request);
    return () => { disposed = true; observer.disconnect(); resizeObserver?.disconnect(); stop(); cancelAnimationFrame(pending); el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); document.removeEventListener('visibilitychange', request); renderer?.domElement.removeEventListener('webglcontextlost', onLoss); resources.forEach(resource => resource.dispose()); renderer?.dispose(); renderer?.domElement.remove(); };
  }, [progress]);
  return <div ref={host} className="pl-product-depth" data-ready={ready} aria-hidden="true" />;
}
