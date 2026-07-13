import { useEffect, useRef, useState } from "react";
import "./xero-hero.css";

export default function XeroHero() {
  const [menuOpen, setMenuOpen] = useState(false);

  const pipelineRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const xRef = useRef<HTMLDivElement>(null);
  const shieldRef = useRef<HTMLDivElement>(null);
  const beamGlowRef = useRef<SVGPathElement>(null);
  const beamCoreRef = useRef<SVGPathElement>(null);
  const gradientRef = useRef<SVGLinearGradientElement>(null);
  const splashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    const pipeline = pipelineRef.current;
    const nodeStack = stackRef.current;
    const nodeX = xRef.current;
    const nodeShield = shieldRef.current;
    const beamGlow = beamGlowRef.current;
    const beamCore = beamCoreRef.current;
    const gradient = gradientRef.current;
    const splash = splashRef.current;

    if (!pipeline || !nodeStack || !nodeX || !nodeShield || !beamGlow || !beamCore || !gradient || !splash) return;

    let startX = 0, startY = 0, midX = 0, midY = 0, endX = 0, endY = 0;

    const compute = () => {
      const pRect = pipeline.getBoundingClientRect();
      const sRect = nodeStack.getBoundingClientRect();
      const xRect = nodeX.getBoundingClientRect();
      const shRect = nodeShield.getBoundingClientRect();
      startX = sRect.left + sRect.width / 2 - pRect.left;
      startY = sRect.top + sRect.height / 2 - pRect.top;
      midX = xRect.left + xRect.width / 2 - pRect.left;
      midY = xRect.top + xRect.height / 2 - pRect.top;
      endX = shRect.left + shRect.width / 2 - pRect.left;
      endY = shRect.top + shRect.height / 2 - pRect.top;
      const d = `M ${startX},${startY} L ${midX},${midY} L ${endX},${endY}`;
      beamGlow.setAttribute("d", d);
      beamCore.setAttribute("d", d);
    };

    compute();
    window.addEventListener("resize", compute);

    let state: "p1" | "splash" | "p2" | "idle" = "p1";
    let lastStateChange = performance.now();
    let rafId = 0;

    const setGradient = (percentage: number) => {
      const center = percentage * 100;
      const halfWidth = 5;
      gradient.setAttribute("x1", (center - halfWidth) + "%");
      gradient.setAttribute("x2", (center + halfWidth) + "%");
      gradient.setAttribute("y1", "0%");
      gradient.setAttribute("y2", "0%");
    };

    const loop = (now: number) => {
      const elapsed = now - lastStateChange;
      if (state === "p1") {
        const t = Math.min(elapsed / 800, 1);
        const p = t * 0.5;
        setGradient(p);
        if (p < 0.4) nodeStack.classList.add("active");
        else nodeStack.classList.remove("active");
        if (t >= 1) {
          nodeStack.classList.remove("active");
          state = "splash";
          lastStateChange = now;
          beamGlow.style.opacity = "0";
          beamCore.style.opacity = "0";
          splash.classList.remove("animate");
          // reflow
          void splash.offsetWidth;
          splash.classList.add("animate");
        }
      } else if (state === "splash") {
        if (elapsed >= 800) {
          state = "p2";
          lastStateChange = now;
          splash.classList.remove("animate");
          beamGlow.style.opacity = "0.6";
          beamCore.style.opacity = "1";
        }
      } else if (state === "p2") {
        const t = Math.min(elapsed / 800, 1);
        const p = 0.5 + t * 0.5;
        setGradient(p);
        if (p > 0.6) nodeShield.classList.add("active");
        if (t >= 1) {
          nodeShield.classList.remove("active");
          state = "idle";
          lastStateChange = now;
        }
      } else if (state === "idle") {
        if (elapsed >= 1000) {
          state = "p1";
          lastStateChange = now;
        }
      }
      rafId = requestAnimationFrame(loop);
    };
    beamGlow.style.opacity = "0.6";
    beamCore.style.opacity = "1";
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", compute);
    };
  }, []);

  return (
    <div className="xero-page">
      <nav className="navbar">
        <div className="nav-logo">Xero</div>
        <div className={`nav-menu${menuOpen ? " active" : ""}`}>
          <ul className="nav-links">
            <li><a href="#method">Method</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#docs">Docs</a></li>
          </ul>
          <div className="nav-actions">
            <button className="btn-login">Log in</button>
            <button className="btn-signup">Sign up</button>
          </div>
        </div>
        <button
          className={`menu-toggle${menuOpen ? " active" : ""}`}
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span></span>
          <span></span>
        </button>
      </nav>

      <section className="hero-card">
        <div className="hero-grid"></div>

        <div className="icon-pipeline" ref={pipelineRef}>
          <svg className="beam-svg" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <linearGradient id="beam-gradient" gradientUnits="userSpaceOnUse" ref={gradientRef}>
                <stop offset="0%" stopColor="#b04090" stopOpacity="0" />
                <stop offset="20%" stopColor="#b04090" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="80%" stopColor="#c8a0e0" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#c8a0e0" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              ref={beamGlowRef}
              stroke="url(#beam-gradient)"
              strokeWidth="2"
              fill="none"
              filter="url(#glow)"
              style={{ opacity: 0.6 }}
            />
            <path
              ref={beamCoreRef}
              stroke="url(#beam-gradient)"
              strokeWidth="0.8"
              fill="none"
            />
          </svg>

          <div
            id="node-stack"
            className="icon-node node-light-right"
            ref={stackRef}
          >
            <svg viewBox="0 0 24 24">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>

          <div className="pipeline-line"></div>

          <div className="center-wrap">
            <div className="splash" ref={splashRef}></div>
            <div id="node-x" className="icon-node-center" ref={xRef}>
              <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 8 L16 8 L20 14 L24 8 L32 8 L24 20 L32 32 L24 32 L20 26 L16 32 L8 32 L16 20 Z" />
              </svg>
            </div>
          </div>

          <div className="pipeline-line right"></div>

          <div
            id="node-shield"
            className="icon-node node-light-left"
            ref={shieldRef}
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </div>
        </div>

        <div className="hero-content">
          <h1 className="hero-heading">
            The simple way
            <strong>encryption your data</strong>
          </h1>
          <p className="hero-sub">
            Fully managed data encrypting service and annotation platform for teams of all industries.
          </p>
          <button className="btn-cta">Get Started</button>
        </div>
      </section>

      <div className="brands">
        <div className="brand-item">
          <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2 L2 12 L12 22 L22 12 Z" />
          </svg>
          <span>Expedia</span>
        </div>
        <div className="brand-item">
          <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="7" r="4" />
            <circle cx="5" cy="16" r="3.5" />
            <circle cx="19" cy="16" r="3.5" />
          </svg>
          <span>asana</span>
        </div>
        <div className="brand-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" xmlns="http://www.w3.org/2000/svg">
            <line x1="4" y1="8" x2="20" y2="8" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="4" y1="16" x2="20" y2="16" />
          </svg>
          <span>zenefits</span>
        </div>
        <div className="brand-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" xmlns="http://www.w3.org/2000/svg">
            <circle cx="15.5" cy="8.5" r="2.5" fill="currentColor" />
            <circle cx="8.5" cy="8.5" r="2" />
            <path d="M8.5 10.5 L8.5 18" />
            <path d="M8.5 18 L15.5 18" />
            <path d="M15.5 11 L15.5 18" />
          </svg>
          <span>HubSp<span className="hubspot-dot"></span>t</span>
        </div>
        <div className="brand-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="3" x2="12" y2="21" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
            <line x1="18.4" y1="5.6" x2="5.6" y2="18.4" />
          </svg>
          <span>loom</span>
        </div>
      </div>
    </div>
  );
}
