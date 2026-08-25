import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { AVATAR_CAMERA } from "@/utils/introGeometry";
import { isCoarsePointer, trackPointerPosition } from "@/utils/pointerTracking";

/** Seconds for the idle float to reach full amplitude after waking. */
const WAKE_RAMP_SECONDS = 0.9;

/** Time constant for the eyes closing the gap to the pointer, in seconds.
 * ~0.26s reproduces what the old fixed 0.06-per-frame felt like at 60fps,
 * but now independently of the render rate. */
const EYE_TAU_SECONDS = 0.26;

/** Same clamp as the body loop's `MAX_FRAME_MS`, in seconds: one long frame
 * must never snap the eyes straight onto the pointer. */
const MAX_FRAME_SECONDS = 0.064;

/**
 * The actual 3D scene — split from `DeveloperAvatar.tsx` so the `three` /
 * `@react-three/fiber` chunk is only ever fetched by the lazy import there,
 * never bundled into the main chunk.
 */
/** Render rate for the avatar on a touch device. The scene is a slow idle
 * float plus smoothed tracking — nothing in it needs 60fps to read correctly,
 * and halving the rate halves its GPU and main-thread cost on the mid-range
 * Android hardware this is actually judged on. */
const TOUCH_FPS = 32;

export default function DeveloperAvatarScene({
  reduceMotion,
  frozen = false,
  paused = false,
}: {
  reduceMotion: boolean;
  frozen?: boolean;
  /** A full-screen surface is covering the avatar — render nothing at all. */
  paused?: boolean;
}) {
  // Read once: a device's primary input does not change mid-session.
  const [coarse] = useState(isCoarsePointer);

  // r3f defaults to `frameloop="always"`, which re-renders the WebGL scene
  // every frame for the whole visit whether or not anything changed. That is
  // one of two rAF loops the avatar was running continuously, and it competed
  // with both scrolling and the project card's expansion.
  //
  //   never  - covered by a modal; nothing to show, so nothing is drawn.
  //   demand - touch devices; `FrameDriver` below invalidates at TOUCH_FPS,
  //            so this is one throttled loop instead of an unbounded one.
  //   always - desktop, unchanged.
  const frameloop = paused ? "never" : coarse ? "demand" : "always";

  return (
    <Canvas
      frameloop={frameloop}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, AVATAR_CAMERA.z], fov: AVATAR_CAMERA.fov }}
      // r3f sizes the canvas from `getBoundingClientRect()`, which includes
      // ancestor CSS transforms — and this canvas lives inside an element
      // the opening sequence and the scroll loop both `scale`. That made the
      // rendered canvas the *scaled* size and then scaled it again, so the
      // avatar came out of the intro locked to a fraction of its box (and
      // only un-stuck because r3f re-measures on scroll — hence "scroll down
      // and back up fixes it"). `offsetSize` switches the measurement to
      // `offsetWidth`/`offsetHeight`, which transforms don't touch, so the
      // canvas always matches its true layout box.
      resize={{ offsetSize: true }}
      // r3f's <Canvas> defaults its own wrapper div to `pointer-events: auto`
      // (for its internal raycasting/event system) regardless of what an
      // ancestor's `pointer-events: none` says — an inline style always
      // overrides an inherited one. This avatar is purely decorative and
      // must never intercept clicks/hover on the real page underneath, so
      // that default has to be overridden explicitly, here, not just on the
      // wrapper div in DeveloperAvatar.tsx.
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 3, 4]} intensity={1.1} />
      {frameloop === "demand" && <FrameDriver fps={TOUCH_FPS} />}
      <AvatarHead reduceMotion={reduceMotion} frozen={frozen} />
    </Canvas>
  );
}

/**
 * Drives a `frameloop="demand"` canvas at a fixed rate.
 *
 * One rAF that asks r3f to render only when enough time has passed. Mounted
 * only while the canvas is on demand, so on desktop it does not exist and on
 * a covered canvas it is unmounted along with everything else.
 */
function FrameDriver({ fps }: { fps: number }) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const interval = 1000 / fps;
    let raf = 0;
    let last = 0;

    function tick(now: number) {
      if (now - last >= interval) {
        last = now;
        invalidate();
      }
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fps, invalidate]);

  return null;
}

function AvatarHead({ reduceMotion, frozen }: { reduceMotion: boolean; frozen: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  /** 0 while frozen, ramps to 1 on waking — scales the idle float in. */
  const wakeRef = useRef(0);
  const { gl } = useThree();
  const pointer = useRef({ x: 0, y: 0 });
  const rectRefresh = useRef<(() => void) | null>(null);
  const [accent, setAccent] = useState("#4f46e5");

  useEffect(() => {
    function readAccent() {
      setAccent(getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#4f46e5");
    }
    readAccent();
    const observer = new MutationObserver(readAccent);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const canvas = gl.domElement;

    // The canvas rect is cached instead of being read inside the handler.
    // `getBoundingClientRect` forces a layout flush, and this handler runs on
    // every pointer move — on a phone that meant a synchronous layout for
    // every sample of a drag. The avatar is in constant motion, so the rect
    // is refreshed on a frame budget rather than on demand.
    let rect = canvas.getBoundingClientRect();
    let rectAge = 0;
    function refreshRect() {
      rect = canvas.getBoundingClientRect();
      rectAge = 0;
    }

    // Pointer *and* touch, via the shared subscription. `pointermove` alone
    // stops arriving as soon as a touch becomes a page scroll, so the eyes
    // used to lock onto whatever the finger's last pre-scroll position was;
    // `touchmove` keeps reporting for the whole gesture. See
    // `pointerTracking.ts`. Still only a ref write per sample — the rect is
    // cached and refreshed on a frame budget, never read here.
    const untrack = trackPointerPosition((px, py) => {
      pointer.current.x = ((px - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = ((py - rect.top) / rect.height) * 2 - 1;
    });
    window.addEventListener("resize", refreshRect);
    window.addEventListener("orientationchange", refreshRect);

    rectRefresh.current = () => {
      // Called from the render loop; the avatar moves continuously, so its
      // rect is stale within a frame or two of being read.
      if (++rectAge > 6) refreshRect();
    };

    return () => {
      untrack();
      window.removeEventListener("resize", refreshRect);
      window.removeEventListener("orientationchange", refreshRect);
      rectRefresh.current = null;
    };
  }, [gl, reduceMotion]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (reduceMotion) return;
    if (frozen) {
      // Held at the exact pose the opening sequence's dot field drew, so
      // the two shapes coincide while the avatar resolves in.
      groupRef.current.rotation.set(0, 0, 0);
      groupRef.current.position.y = 0;
      wakeRef.current = 0;
      return;
    }

    // The idle float is a sine of the scene clock, so at the instant of
    // waking it can be anywhere in its cycle — switching it on outright
    // popped the avatar by up to ~9px. Ramping its amplitude in means it
    // drifts up from exactly where it was standing. Rotation needs no ramp:
    // it already eases from 0 toward the cursor.
    wakeRef.current = Math.min(1, wakeRef.current + delta / WAKE_RAMP_SECONDS);
    rectRefresh.current?.();

    const targetY = pointer.current.x * 0.35;
    // `pointer.y` is measured in screen space (+1 at the *bottom* of the
    // canvas), not in NDC (+1 at the top). The extra negation this used to
    // carry was the NDC convention applied to a non-NDC value, which flipped
    // vertical tracking: pointer below the avatar tipped it to look up.
    // Three.js rotates +x by moving the face down, which is exactly what a
    // positive (downward) screen-space y should do.
    const targetX = pointer.current.y * 0.2;
    // Delta-based, not a fixed 0.06 per frame. A per-frame constant silently
    // couples the eyes' tracking *speed* to the render rate: at the throttled
    // touch rate they closed 0.06 of the gap 32 times a second instead of 60,
    // so they tracked at roughly half the speed of the body — which is what
    // desynchronised them from it. Derived from real elapsed time, the eyes
    // now cover the same ground per millisecond whatever the canvas is
    // rendering at, and match the body's own smoothing model.
    const eyeAlpha = 1 - Math.exp(-Math.min(delta, MAX_FRAME_SECONDS) / EYE_TAU_SECONDS);
    groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * eyeAlpha;
    groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * eyeAlpha;
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.06 * wakeRef.current;
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={accent} wireframe metalness={0.2} roughness={0.5} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={accent} transparent opacity={0.06} />
      </mesh>
      <mesh position={[-0.32, 0.08, 0.92]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0.32, 0.08, 0.92]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}
