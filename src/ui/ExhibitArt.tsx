import type { ReactElement } from 'react';

/*
 * Hand-drawn SVG exhibits for the museum. Inline shapes only: no images,
 * fonts or remote assets. Each drawing uses a 48×48 box.
 */

const ART: Record<string, ReactElement> = {
  // ------------------------------------------------------------ minerals
  quartz: (
    <g>
      <path d="M10 42 L14 18 L18 12 L22 18 L22 42Z" fill="#e8f1f8" stroke="#9bb3c7" />
      <path d="M20 42 L23 10 L28 4 L32 10 L32 42Z" fill="#f6fbff" stroke="#9bb3c7" />
      <path d="M30 42 L33 22 L37 17 L40 22 L40 42Z" fill="#dce9f3" stroke="#9bb3c7" />
      <path d="M28 4 L28 42" stroke="#c4d6e4" />
      <rect x="6" y="40" width="36" height="4" rx="2" fill="#8a7f72" />
    </g>
  ),
  geode: (
    <g>
      <ellipse cx="24" cy="26" rx="19" ry="16" fill="#77736e" />
      <ellipse cx="24" cy="26" rx="14" ry="11.5" fill="#efe7f7" />
      <ellipse cx="24" cy="26" rx="12" ry="9.5" fill="#9b6bd1" />
      <path d="M14 26 L18 20 L20 27 L24 18 L27 27 L30 20 L34 26 L30 32 L27 27 L24 34 L20 27 L18 32Z" fill="#c9a6ef" />
    </g>
  ),
  emerald: (
    <g>
      <path d="M8 40 Q10 28 18 26 Q30 22 40 30 Q42 38 38 42 L10 42Z" fill="#8c8478" />
      <path d="M18 34 L22 12 L30 10 L34 30 L26 38Z" fill="#2fb36d" stroke="#1d7a48" />
      <path d="M22 12 L26 36 M30 10 L26 36" stroke="#7de0a6" />
    </g>
  ),
  sapphire: (
    <g>
      <path d="M12 18 L18 10 L30 10 L36 18 L24 40Z" fill="#2c64d6" stroke="#1b3f8f" />
      <path d="M12 18 L36 18 M18 10 L22 18 L24 40 L26 18 L30 10 M22 18 L24 10 L26 18" stroke="#8fb4ff" fill="none" />
      <circle cx="17" cy="15" r="1.5" fill="#fff" />
    </g>
  ),
  opal: (
    <g>
      <ellipse cx="24" cy="25" rx="15" ry="18" fill="#f4e9f2" stroke="#c9b6c8" />
      <ellipse cx="20" cy="20" rx="5" ry="4" fill="#ff7a59" opacity="0.75" />
      <ellipse cx="29" cy="24" rx="5" ry="6" fill="#5bd1c1" opacity="0.75" />
      <ellipse cx="22" cy="31" rx="6" ry="4" fill="#ffd25e" opacity="0.75" />
      <ellipse cx="29" cy="34" rx="3" ry="3" fill="#9a7bff" opacity="0.75" />
      <ellipse cx="18" cy="14" rx="3" ry="1.6" fill="#fff" opacity="0.9" />
    </g>
  ),
  stardiamond: (
    <g>
      <path d="M8 18 L16 8 L32 8 L40 18 L24 42Z" fill="#eaf6ff" stroke="#7fa8c9" />
      <path d="M8 18 L40 18 M16 8 L20 18 L24 42 L28 18 L32 8 M20 18 L24 8 L28 18" stroke="#9cc1dd" fill="none" />
      <path d="M38 4 L39.5 8 L43.5 9 L39.5 10 L38 14 L36.5 10 L32.5 9 L36.5 8Z" fill="#ffd95e" />
      <path d="M8 30 L9 33 L12 34 L9 35 L8 38 L7 35 L4 34 L7 33Z" fill="#ffd95e" />
    </g>
  ),

  // ------------------------------------------------------------- fossils
  ammonite: (
    <g>
      <circle cx="24" cy="24" r="18" fill="#c9a77a" stroke="#8a6a44" />
      <path d="M24 24 m0 -3 a3 3 0 1 1 -3 3 a6 6 0 1 1 6 6 a9 9 0 1 1 -9 -9 a12 12 0 1 1 12 12 a15 15 0 0 1 -15 -15" fill="none" stroke="#8a6a44" strokeWidth="1.6" />
    </g>
  ),
  trilobite: (
    <g>
      <rect x="6" y="6" width="36" height="36" rx="6" fill="#9a9183" />
      <path d="M24 9 C33 9 35 15 34 19 C33 27 30 36 24 40 C18 36 15 27 14 19 C13 15 15 9 24 9Z" fill="#5d564c" />
      <path d="M17 18 H31 M17 22 H31 M18 26 H30 M19 30 H29 M21 34 H27 M24 12 V38" stroke="#b6ad9e" />
      <circle cx="19" cy="14" r="1.5" fill="#2b2620" />
      <circle cx="29" cy="14" r="1.5" fill="#2b2620" />
    </g>
  ),
  sharktooth: (
    <g>
      <path d="M8 16 Q24 10 40 16 L24 44Z" fill="#f2ead8" stroke="#a8977a" />
      <path d="M8 16 Q24 10 40 16 Q24 20 8 16Z" fill="#6f6556" />
      <path d="M12 21 L13 23 M16 27 L17 29 M36 21 L35 23 M32 27 L31 29" stroke="#a8977a" />
    </g>
  ),
  amber: (
    <g>
      <path d="M12 12 Q24 4 36 12 Q44 26 34 38 Q24 44 14 38 Q4 26 12 12Z" fill="#f0a52b" stroke="#b5701a" />
      <ellipse cx="24" cy="25" rx="3" ry="5" fill="#4a2e10" />
      <ellipse cx="19" cy="22" rx="5" ry="2.4" fill="#fff" opacity="0.5" transform="rotate(-25 19 22)" />
      <ellipse cx="29" cy="22" rx="5" ry="2.4" fill="#fff" opacity="0.5" transform="rotate(25 29 22)" />
      <path d="M22 29 L18 33 M26 29 L30 33" stroke="#4a2e10" />
      <ellipse cx="16" cy="14" rx="4" ry="2" fill="#ffe2a6" opacity="0.8" />
    </g>
  ),
  claw: (
    <g>
      <path d="M14 42 C10 26 18 8 38 6 C28 12 24 22 26 42Z" fill="#efe6d2" stroke="#a8977a" strokeWidth="1.4" />
      <path d="M16 38 C15 28 20 16 32 10" stroke="#cbbd9f" fill="none" />
      <rect x="10" y="40" width="22" height="4" rx="2" fill="#5d564c" />
    </g>
  ),
  trex: (
    <g>
      <path d="M6 22 Q8 10 22 9 Q36 8 42 16 Q44 22 40 24 L40 30 Q30 32 22 30 L14 34 Q8 32 6 22Z" fill="#efe6d2" stroke="#a8977a" />
      <circle cx="31" cy="15" r="3" fill="#3a3329" />
      <ellipse cx="19" cy="17" rx="4" ry="3" fill="#3a3329" />
      <path d="M22 30 L23 34 L25 30.5 L26 34 L28 31 L29 34.5 L31 31 L32 34 L34 31 L35 33.5 L37 30.5" fill="#fff" stroke="#a8977a" strokeWidth="0.8" />
      <path d="M22 26 L24 29 L26 26.5 L28 29.5 L30 27 L32 29.5 L34 27 L36 29 L38 26.5" fill="#fff" stroke="#a8977a" strokeWidth="0.8" />
      <rect x="10" y="40" width="28" height="4" rx="2" fill="#5d564c" />
      <path d="M14 34 L16 40 M32 32 L30 40" stroke="#5d564c" strokeWidth="2" />
    </g>
  ),

  // ---------------------------------------------------------- antiquities
  pot: (
    <g>
      <path d="M17 8 H31 V12 Q38 16 38 26 Q38 40 24 42 Q10 40 10 26 Q10 16 17 12Z" fill="#c8693d" stroke="#8a4425" />
      <path d="M11 24 H37 M12 30 H36" stroke="#2b1a10" strokeWidth="2" />
      <path d="M15 27 L18 25 L21 27 L24 25 L27 27 L30 25 L33 27" stroke="#f3d7b5" fill="none" />
      <rect x="16" y="6" width="16" height="3" rx="1.5" fill="#8a4425" />
    </g>
  ),
  coin: (
    <g>
      <circle cx="24" cy="24" r="17" fill="#b4793b" stroke="#7a4f22" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="13" fill="none" stroke="#d9a465" strokeDasharray="2 2" />
      <path d="M20 16 Q28 14 28 22 Q28 26 24 27 L24 31 M21 33 H27" stroke="#5e3a17" strokeWidth="2" fill="none" />
      <circle cx="21" cy="21" r="1.5" fill="#5e3a17" />
    </g>
  ),
  lamp: (
    <g>
      <path d="M6 30 Q8 22 22 22 L36 24 Q42 25 44 22 Q44 30 36 32 Q20 36 6 30Z" fill="#b5884c" stroke="#7a5a2c" />
      <circle cx="20" cy="26" r="2.5" fill="#7a5a2c" />
      <path d="M42 18 Q46 12 42 6 Q38 12 42 18Z" fill="#ffb238" />
      <path d="M42 17 Q44 13 42 10 Q40 13 42 17Z" fill="#fff1b8" />
      <path d="M8 26 Q2 26 4 32" stroke="#7a5a2c" strokeWidth="2" fill="none" />
    </g>
  ),
  scarab: (
    <g>
      <ellipse cx="24" cy="27" rx="12" ry="14" fill="#e3b23c" stroke="#9a7116" />
      <path d="M24 13 V41 M12 25 Q24 22 36 25" stroke="#9a7116" fill="none" />
      <ellipse cx="24" cy="11" rx="6" ry="4" fill="#e3b23c" stroke="#9a7116" />
      <path d="M12 20 L5 15 M12 30 L4 32 M36 20 L43 15 M36 30 L44 32 M18 39 L14 45 M30 39 L34 45" stroke="#9a7116" strokeWidth="2" />
      <circle cx="19" cy="20" r="1.4" fill="#2aa198" />
      <circle cx="29" cy="20" r="1.4" fill="#2aa198" />
    </g>
  ),
  mask: (
    <g>
      <path d="M10 10 Q24 2 38 10 L38 26 Q38 42 24 44 Q10 42 10 26Z" fill="#f0bf3e" stroke="#9a7116" />
      <path d="M10 14 Q4 22 8 34 L12 32 M38 14 Q44 22 40 34 L36 32" fill="#2a5aa8" stroke="#1b3f8f" />
      <path d="M15 21 Q18 18 21 21 Q18 23 15 21Z M27 21 Q30 18 33 21 Q30 23 27 21Z" fill="#1d1d2a" />
      <path d="M24 22 V30 L22 31" stroke="#9a7116" fill="none" />
      <path d="M20 35 Q24 37 28 35" stroke="#9a7116" fill="none" />
    </g>
  ),
  crown: (
    <g>
      <path d="M8 34 L6 14 L16 24 L24 8 L32 24 L42 14 L40 34Z" fill="#d6ecfb" stroke="#7fa8c9" />
      <rect x="8" y="34" width="32" height="6" rx="2" fill="#b9d6ec" stroke="#7fa8c9" />
      <circle cx="24" cy="26" r="3" fill="#e0457b" />
      <circle cx="15" cy="30" r="2" fill="#5bd1c1" />
      <circle cx="33" cy="30" r="2" fill="#5bd1c1" />
      <circle cx="6" cy="14" r="2" fill="#ffd95e" />
      <circle cx="24" cy="8" r="2" fill="#ffd95e" />
      <circle cx="42" cy="14" r="2" fill="#ffd95e" />
    </g>
  ),

  // --------------------------------------------------------------- space
  meteorite: (
    <g>
      <path d="M10 22 Q12 10 24 9 Q38 10 40 22 Q42 36 28 40 Q12 42 10 22Z" fill="#5d5a57" stroke="#3a3836" />
      <circle cx="19" cy="20" r="3" fill="#47443f" />
      <circle cx="30" cy="28" r="4" fill="#47443f" />
      <circle cx="22" cy="32" r="2" fill="#47443f" />
      <path d="M26 15 L32 17" stroke="#b8b2a8" strokeWidth="1.5" />
    </g>
  ),
  moonrock: (
    <g>
      <path d="M8 34 Q8 18 22 14 Q36 12 40 26 Q42 38 30 40 L14 40 Q8 40 8 34Z" fill="#c9c7c2" stroke="#8a8780" />
      <circle cx="20" cy="24" r="3.5" fill="#a9a6a0" />
      <circle cx="30" cy="31" r="2.5" fill="#a9a6a0" />
      <circle cx="31" cy="20" r="1.5" fill="#a9a6a0" />
      <path d="M38 6 L39 9 L42 10 L39 11 L38 14 L37 11 L34 10 L37 9Z" fill="#fff6c9" />
    </g>
  ),
  telescope: (
    <g>
      <path d="M8 22 L36 10 L39 17 L11 29Z" fill="#d6a447" stroke="#8a6420" />
      <path d="M36 10 L42 8 L44 14 L39 17Z" fill="#b5822c" stroke="#8a6420" />
      <path d="M8 22 L6 23 L8 29 L11 29" fill="#8a6420" />
      <path d="M22 22 L14 44 M22 22 L30 44 M22 22 L22 44" stroke="#5d4a2c" strokeWidth="2" />
    </g>
  ),
  astrolabe: (
    <g>
      <circle cx="24" cy="26" r="17" fill="#d6a447" stroke="#8a6420" strokeWidth="1.5" />
      <circle cx="24" cy="26" r="12" fill="#2b3b66" stroke="#8a6420" />
      <path d="M24 14 V38 M12 26 H36" stroke="#8a6420" />
      <path d="M15 20 L33 32" stroke="#f0d28a" strokeWidth="2" />
      <circle cx="24" cy="26" r="2" fill="#f0d28a" />
      <circle cx="18" cy="31" r="1" fill="#fff" />
      <circle cx="30" cy="19" r="1" fill="#fff" />
      <rect x="21" y="5" width="6" height="5" rx="2" fill="#d6a447" stroke="#8a6420" />
    </g>
  ),
  planet: (
    <g>
      <circle cx="24" cy="22" r="11" fill="#e8955c" />
      <path d="M14 18 Q24 15 34 18 M13 24 Q24 21 35 24" stroke="#c4683a" strokeWidth="2" fill="none" />
      <ellipse cx="24" cy="22" rx="20" ry="6" fill="none" stroke="#bfe2ff" strokeWidth="2.5" transform="rotate(-15 24 22)" />
      <path d="M13 21 A11 11 0 0 1 35 21" fill="#e8955c" transform="rotate(-15 24 22)" />
      <path d="M22 34 V40 M16 42 H32" stroke="#8a6420" strokeWidth="2.5" />
    </g>
  ),
  comet: (
    <g>
      <rect x="12" y="8" width="24" height="5" rx="2" fill="#8a6420" />
      <path d="M12 13 H36 V38 Q36 44 30 44 H18 Q12 44 12 38Z" fill="#1d2a4d" stroke="#bfe2ff" strokeWidth="1.5" opacity="0.95" />
      <path d="M20 22 Q26 30 32 38" stroke="#7fd8ff" strokeWidth="3" opacity="0.5" fill="none" />
      <circle cx="20" cy="22" r="3.5" fill="#fff6c9" />
      <circle cx="28" cy="18" r="0.8" fill="#fff" />
      <circle cx="17" cy="34" r="0.8" fill="#fff" />
      <path d="M15 16 V28" stroke="#fff" opacity="0.35" strokeWidth="2" />
    </g>
  ),

  // -------------------------------------------------------------- curios
  watch: (
    <g>
      <path d="M24 4 V10" stroke="#b5822c" strokeWidth="2" />
      <circle cx="24" cy="5" r="3" fill="none" stroke="#b5822c" strokeWidth="2" />
      <circle cx="24" cy="27" r="16" fill="#e3b23c" stroke="#9a7116" />
      <circle cx="24" cy="27" r="13" fill="#fffaf0" />
      <path d="M24 17 V19 M24 35 V37 M14 27 H16 M32 27 H34" stroke="#3a3329" strokeWidth="1.5" />
      <path d="M24 27 L24 20 M24 27 L29 30" stroke="#3a3329" strokeWidth="1.6" />
    </g>
  ),
  musicbox: (
    <g>
      <path d="M8 22 L24 16 L40 22 L24 28Z" fill="#c45b7a" stroke="#7a2f46" />
      <path d="M8 22 V36 L24 42 V28Z" fill="#a8455f" stroke="#7a2f46" />
      <path d="M40 22 V36 L24 42 V28Z" fill="#8f3a52" stroke="#7a2f46" />
      <path d="M14 30 L18 31.5" stroke="#f0d28a" strokeWidth="1.5" />
      <path d="M32 8 V14 M32 8 L36 9" stroke="#3a3329" strokeWidth="1.4" />
      <circle cx="31" cy="14" r="1.6" fill="#3a3329" />
      <path d="M38 4 V9" stroke="#3a3329" strokeWidth="1.4" />
      <circle cx="37" cy="9.5" r="1.4" fill="#3a3329" />
    </g>
  ),
  snowglobe: (
    <g>
      <circle cx="24" cy="21" r="15" fill="#cfe9ff" stroke="#8fb4d6" />
      <path d="M14 30 Q24 26 34 30 Q32 34 24 35 Q16 34 14 30Z" fill="#fff" />
      <path d="M19 30 V24 L22 21 L25 24 V30Z" fill="#c4683a" />
      <path d="M26 30 V22 L29 19 L32 22 V30Z" fill="#7a9cc6" />
      <circle cx="18" cy="14" r="1" fill="#fff" />
      <circle cx="28" cy="11" r="1" fill="#fff" />
      <circle cx="32" cy="16" r="1" fill="#fff" />
      <path d="M12 36 H36 L38 43 H10Z" fill="#7a4f22" />
    </g>
  ),
  ship: (
    <g>
      <path d="M4 24 Q4 14 14 14 H38 L44 20 V28 L38 34 H14 Q4 34 4 24Z" fill="#dff2ee" stroke="#7fb3a8" />
      <path d="M44 20 H47 V28 H44" fill="#8a6420" />
      <path d="M12 28 H34 L31 32 H15Z" fill="#7a4f22" />
      <path d="M22 28 V16 M28 28 V18" stroke="#5d4a2c" />
      <path d="M22 16 L16 26 H22Z M28 18 L33 26 H28Z" fill="#fff" stroke="#c4bfb3" strokeWidth="0.6" />
      <path d="M8 30 Q24 33 40 30" stroke="#5aa6d6" fill="none" />
    </g>
  ),
  bird: (
    <g>
      <path d="M10 30 Q12 18 24 18 Q32 18 34 24 L42 20 L38 28 Q34 36 22 36 Q12 36 10 30Z" fill="#c9a34a" stroke="#8a6a20" />
      <circle cx="16" cy="25" r="2" fill="#2b2620" />
      <path d="M10 26 L5 27 L10 29" fill="#e08a2c" />
      <path d="M20 26 Q26 22 32 27" stroke="#8a6a20" fill="none" />
      <circle cx="24" cy="31" r="2.5" fill="none" stroke="#8a6a20" />
      <path d="M22 36 V42 M28 36 V42 M16 42 H34" stroke="#5d4a2c" strokeWidth="2" />
      <path d="M28 14 L30 10 M32 15 L36 12" stroke="#8a6a20" strokeWidth="1.4" />
    </g>
  ),
  egg: (
    <g>
      <ellipse cx="24" cy="25" rx="13" ry="17" fill="#3fa37a" stroke="#256b4e" />
      <path d="M14 18 Q18 15 20 19 Q22 15 26 18 Q28 14 32 18 M12 28 Q16 25 19 29 Q22 25 26 29 Q29 25 33 28 M15 36 Q19 33 22 37 Q25 33 30 36" stroke="#7fd8b2" fill="none" />
      <ellipse cx="19" cy="14" rx="3" ry="1.6" fill="#c9f2df" opacity="0.8" />
      <ellipse cx="24" cy="43" rx="13" ry="3" fill="#7a4f22" />
    </g>
  ),
};

export function ExhibitArt({ id, size = 48, className }: { id: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false" className={className}>
      {ART[id] ?? <circle cx="24" cy="24" r="10" fill="#888" />}
    </svg>
  );
}

export const HAS_ART = (id: string): boolean => id in ART;
