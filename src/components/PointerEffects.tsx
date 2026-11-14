import { useEffect, useRef } from 'react';

/**
 * Decorative pointer effects only: no pointer capture, no layout shifts,
 * and no React re-renders during mouse movement.
 * Desktop gets a soft cursor halo; touch devices get tap ripples and ambient light.
 */
export function PointerEffects() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const ripples = new Set<HTMLSpanElement>();
    let frame = 0;
    let x = 0;
    let y = 0;

    const onMove = (event: PointerEvent) => {
      if (reducedMotion.matches || !finePointer.matches || event.pointerType === 'touch') return;
      x = event.clientX;
      y = event.clientY;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        layer.style.setProperty('--tc-x', x + 'px');
        layer.style.setProperty('--tc-y', y + 'px');
        layer.dataset.pointerActive = 'true';
        frame = 0;
      });
    };

    const onDown = (event: PointerEvent) => {
      if (reducedMotion.matches || !event.isPrimary) return;
      const ripple = document.createElement('span');
      ripple.className = 'tc-pointer-ripple';
      ripple.dataset.input = event.pointerType === 'mouse' ? 'mouse' : 'touch';
      ripple.style.left = event.clientX + 'px';
      ripple.style.top = event.clientY + 'px';
      layer.appendChild(ripple);
      ripples.add(ripple);

      ripple.addEventListener('animationend', () => {
        ripple.remove();
        ripples.delete(ripple);
      }, { once: true });

      // Bound DOM work even if the user taps rapidly.
      if (ripples.size > 8) {
        const oldest = ripples.values().next().value;
        if (oldest) {
          oldest.remove();
          ripples.delete(oldest);
        }
      }
    };

    const hide = () => { layer.dataset.pointerActive = 'false'; };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('mouseleave', hide);
    window.addEventListener('blur', hide);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('mouseleave', hide);
      window.removeEventListener('blur', hide);
      if (frame) window.cancelAnimationFrame(frame);
      ripples.forEach(ripple => ripple.remove());
    };
  }, []);

  return (
    <div ref={layerRef} className="tc-pointer-layer" data-pointer-active="false" aria-hidden="true">
      <span className="tc-pointer-glow" />
      <span className="tc-pointer-ring" />
      <span className="tc-pointer-dot" />
      <span className="tc-mobile-orb tc-mobile-orb--left" />
      <span className="tc-mobile-orb tc-mobile-orb--right" />
    </div>
  );
}
