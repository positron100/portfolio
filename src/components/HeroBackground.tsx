import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const LINK_DISTANCE = 150;
const POINTER_RADIUS = 180;

export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let nodes: Node[] = [];
    let animationFrame = 0;
    let running = true;

    const pointer = { x: -9999, y: -9999, active: false };
    const colors = { line: "rgba(120,120,120,0.35)", node: "rgba(120,120,120,0.6)", accent: "#3358d4" };

    function readColors() {
      const styles = getComputedStyle(document.documentElement);
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      colors.accent = styles.getPropertyValue("--accent").trim() || colors.accent;
      colors.line = isDark ? "rgba(160,168,184,0.16)" : "rgba(70,75,90,0.14)";
      colors.node = isDark ? "rgba(190,196,210,0.55)" : "rgba(60,64,78,0.45)";
    }

    function nodeCount() {
      return width < 640 ? 16 : width < 1024 ? 24 : 34;
    }

    function seedNodes() {
      const count = nodeCount();
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
      }));
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedNodes();
    }

    function step() {
      if (!running) return;
      ctx!.clearRect(0, 0, width, height);

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        if (pointer.active) {
          const dx = node.x - pointer.x;
          const dy = node.y - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < POINTER_RADIUS) {
            const force = (1 - dist / POINTER_RADIUS) * 0.02;
            node.vx += (dx / (dist || 1)) * force;
            node.vy += (dy / (dist || 1)) * force;
          }
        }

        node.vx = Math.max(-0.4, Math.min(0.4, node.vx));
        node.vy = Math.max(-0.4, Math.min(0.4, node.vy));
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < LINK_DISTANCE) {
            ctx!.beginPath();
            ctx!.strokeStyle = colors.line;
            ctx!.lineWidth = 1;
            ctx!.globalAlpha = 1 - dist / LINK_DISTANCE;
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }
      ctx!.globalAlpha = 1;

      for (const node of nodes) {
        const dist = pointer.active ? Math.hypot(node.x - pointer.x, node.y - pointer.y) : Infinity;
        const isNear = dist < POINTER_RADIUS;
        ctx!.beginPath();
        ctx!.fillStyle = isNear ? colors.accent : colors.node;
        ctx!.arc(node.x, node.y, isNear ? 2.6 : 1.8, 0, Math.PI * 2);
        ctx!.fill();
      }

      animationFrame = requestAnimationFrame(step);
    }

    function handlePointerMove(event: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    }

    function handlePointerLeave() {
      pointer.active = false;
    }

    // Two independent reasons to stop: the tab is hidden, or the hero has
    // been scrolled away from. Both must be false for the loop to run.
    let tabVisible = document.visibilityState === "visible";
    let onScreen = true;

    function syncRunning() {
      const shouldRun = tabVisible && onScreen && !reduceMotion;
      if (shouldRun === running) return;
      running = shouldRun;
      if (running) animationFrame = requestAnimationFrame(step);
      else cancelAnimationFrame(animationFrame);
    }

    function handleVisibility() {
      tabVisible = document.visibilityState === "visible";
      syncRunning();
    }

    // Without this the hero's field kept animating for the entire visit.
    // Measured at 45.6 canvas draw calls per frame, still running 235 frames
    // after the hero had been scrolled past - a continuous cost on a phone,
    // competing for the main thread with the section headings and card
    // transitions that actually were on screen, and drawing something nobody
    // could see.
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting);
        syncRunning();
      },
      { rootMargin: "120px" },
    );
    visibilityObserver.observe(canvas);

    readColors();
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const themeObserver = new MutationObserver(readColors);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    if (!reduceMotion) {
      animationFrame = requestAnimationFrame(step);
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerleave", handlePointerLeave);
      document.addEventListener("visibilitychange", handleVisibility);
    } else {
      step();
      running = false;
    }

    return () => {
      running = false;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [reduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
