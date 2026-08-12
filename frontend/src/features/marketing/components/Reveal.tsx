import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fades/slides a section in the first time it scrolls into view. Disconnects
 * after triggering once - this is a one-way entrance effect, not a
 * scroll-linked animation, so there's nothing left to observe afterward.
 */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal${visible ? " reveal--visible" : ""}${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}
