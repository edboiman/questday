import type { ReactElement } from 'react';
import type { BuildingId } from '../domain/types';
import type { RosterEntry } from '../domain/city';

/*
 * Hand-drawn SVG art for the town. No images, fonts or remote assets, so it
 * works offline and adds nothing to the network surface.
 */

const SHADOW = <ellipse cx="24" cy="42" rx="17" ry="3.2" fill="#000" opacity="0.22" />;

const ART: Record<BuildingId, ReactElement> = {
  cottage: (
    <>
      {SHADOW}
      <rect x="10" y="22" width="28" height="19" rx="1.5" fill="#f1d9b5" />
      <polygon points="6,24 24,8 42,24" fill="#c0563f" />
      <rect x="31" y="11" width="4" height="8" fill="#8f4a38" />
      <rect x="20" y="29" width="8" height="12" rx="1" fill="#7a4a2b" />
      <rect x="12.5" y="27" width="5" height="5" rx="0.8" fill="#8ecae6" />
      <rect x="30.5" y="27" width="5" height="5" rx="0.8" fill="#8ecae6" />
    </>
  ),
  townhouse: (
    <>
      {SHADOW}
      <rect x="11" y="12" width="26" height="29" rx="1.5" fill="#d9b8a0" />
      <rect x="9" y="8" width="30" height="6" rx="1.5" fill="#8a5a44" />
      <rect x="14" y="17" width="6" height="6" rx="0.8" fill="#8ecae6" />
      <rect x="28" y="17" width="6" height="6" rx="0.8" fill="#8ecae6" />
      <rect x="14" y="27" width="6" height="6" rx="0.8" fill="#8ecae6" />
      <rect x="28" y="27" width="6" height="6" rx="0.8" fill="#8ecae6" />
      <rect x="21" y="31" width="6" height="10" rx="1" fill="#6b3f26" />
    </>
  ),
  bakery: (
    <>
      {SHADOW}
      <rect x="8" y="20" width="32" height="21" rx="1.5" fill="#f3c98b" />
      <rect x="6" y="15" width="36" height="8" rx="1.5" fill="#e4553f" />
      <path d="M12 15v8M18 15v8M24 15v8M30 15v8M36 15v8" stroke="#fff" strokeWidth="2.4" />
      <rect x="31" y="8" width="4" height="8" fill="#9b6b4a" />
      <rect x="11" y="27" width="14" height="14" rx="1" fill="#8ecae6" opacity="0.9" />
      <ellipse cx="18" cy="38" rx="5" ry="2.4" fill="#c98a3e" />
      <rect x="29" y="28" width="7" height="13" rx="1" fill="#7a4a2b" />
    </>
  ),
  market: (
    <>
      {SHADOW}
      <rect x="7" y="29" width="34" height="12" rx="1.5" fill="#b98a5e" />
      <path d="M5 16h38l-3 11H8z" fill="#4fae6b" />
      <path d="M11 16l-1.5 11M18 16l-.7 11M25 16v11M32 16l.7 11M38 16l1.5 11" stroke="#fff" strokeWidth="2.2" />
      <circle cx="14" cy="32" r="3" fill="#e4553f" />
      <circle cx="21" cy="32" r="3" fill="#f2b632" />
      <circle cx="28" cy="32" r="3" fill="#8fd16a" />
      <circle cx="35" cy="32" r="3" fill="#e4553f" />
    </>
  ),
  cafe: (
    <>
      {SHADOW}
      <rect x="9" y="21" width="30" height="20" rx="1.5" fill="#a9d6c5" />
      <path d="M7 16h34l-2 8H9z" fill="#2f8f83" />
      <rect x="13" y="27" width="12" height="9" rx="1" fill="#fff" opacity="0.85" />
      <rect x="29" y="28" width="7" height="13" rx="1" fill="#6b4a38" />
      <path d="M17 12c-1.5-2 1.5-3 0-5M22 12c-1.5-2 1.5-3 0-5" stroke="#fff" strokeWidth="1.4" fill="none" opacity="0.8" />
    </>
  ),
  boutique: (
    <>
      {SHADOW}
      <rect x="8" y="14" width="32" height="27" rx="2" fill="#c9b6e4" />
      <rect x="8" y="12" width="32" height="5" rx="1.5" fill="#7b5ab8" />
      <rect x="12" y="21" width="15" height="14" rx="1.5" fill="#f5f0ff" />
      <rect x="30" y="24" width="6" height="17" rx="1" fill="#5d4390" />
      <polygon points="19.5,24 21,27.2 24.4,27.6 21.9,29.9 22.6,33.2 19.5,31.6 16.4,33.2 17.1,29.9 14.6,27.6 18,27.2" fill="#f2b632" />
    </>
  ),
  park: (
    <>
      <ellipse cx="24" cy="36" rx="19" ry="8" fill="#6bbf6e" />
      <rect x="22" y="22" width="4" height="14" fill="#8a5a3a" />
      <circle cx="24" cy="18" r="10" fill="#3f9d57" />
      <circle cx="18" cy="22" r="6" fill="#4fb068" />
      <circle cx="31" cy="22" r="6" fill="#4fb068" />
      <rect x="8" y="35" width="10" height="3" rx="1" fill="#b98a5e" />
    </>
  ),
  fountain: (
    <>
      {SHADOW}
      <ellipse cx="24" cy="34" rx="16" ry="7" fill="#a8b2c4" />
      <ellipse cx="24" cy="33" rx="13" ry="5" fill="#6cc3e8" />
      <rect x="22.5" y="19" width="3" height="14" fill="#a8b2c4" />
      <ellipse cx="24" cy="21" rx="6" ry="2.4" fill="#a8b2c4" />
      <path d="M24 20c-4-6-9-5-10 0M24 20c4-6 9-5 10 0M24 20V10" stroke="#bfeaff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </>
  ),
  library: (
    <>
      {SHADOW}
      <rect x="9" y="20" width="30" height="21" fill="#c9a888" />
      <polygon points="6,21 24,8 42,21" fill="#8a6a50" />
      <path d="M13 24v17M20 24v17M28 24v17M35 24v17" stroke="#f1e4d2" strokeWidth="3" />
      <rect x="6" y="40" width="36" height="3" rx="1" fill="#8a6a50" />
      <rect x="21" y="13" width="6" height="5" rx="0.8" fill="#f2d48a" />
    </>
  ),
  gardens: (
    <>
      <rect x="5" y="14" width="38" height="27" rx="4" fill="#4a9e5c" />
      <rect x="9" y="18" width="14" height="8" rx="2" fill="#7fcf86" />
      <rect x="25" y="18" width="14" height="8" rx="2" fill="#7fcf86" />
      <rect x="9" y="29" width="30" height="8" rx="2" fill="#7fcf86" />
      {[[12, 22, '#f27da5'], [17, 21, '#f2d34f'], [20, 24, '#fff'], [29, 21, '#9a7bff'], [34, 23, '#f27da5'], [13, 33, '#f2d34f'], [20, 34, '#9a7bff'], [27, 33, '#f27da5'], [34, 34, '#fff']].map(([x, y, c]) => (
        <circle key={`${x}-${y}`} cx={x as number} cy={y as number} r="1.9" fill={c as string} />
      ))}
    </>
  ),
  carousel: (
    <>
      {SHADOW}
      <ellipse cx="24" cy="37" rx="16" ry="5" fill="#9a7bff" />
      <path d="M15 37V22M24 37V20M33 37V22" stroke="#f2d48a" strokeWidth="2" />
      <polygon points="6,22 24,8 42,22" fill="#e4553f" />
      <path d="M13 17l3 5M24 10v12M35 17l-3 5" stroke="#fff" strokeWidth="2.2" />
      <circle cx="24" cy="8" r="2" fill="#f2d34f" />
      <circle cx="19" cy="31" r="2.6" fill="#fff" />
      <circle cx="29" cy="31" r="2.6" fill="#fff" />
    </>
  ),
  cinema: (
    <>
      {SHADOW}
      <rect x="8" y="14" width="32" height="27" rx="2" fill="#4b4368" />
      <rect x="6" y="11" width="36" height="8" rx="2" fill="#2f2a47" />
      {[10, 16, 22, 28, 34, 40].map((x) => (
        <circle key={x} cx={x - 1.5} cy="15" r="1.3" fill="#f2d34f" />
      ))}
      <rect x="12" y="23" width="10" height="9" rx="1" fill="#f2d48a" />
      <rect x="26" y="23" width="10" height="9" rx="1" fill="#f2d48a" />
      <rect x="20" y="33" width="8" height="8" rx="1" fill="#e4553f" />
    </>
  ),
  ferris: (
    <>
      {SHADOW}
      <path d="M24 24L14 42M24 24l10 18" stroke="#8a93a8" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="24" cy="22" r="15" fill="none" stroke="#e4553f" strokeWidth="2" />
      <circle cx="24" cy="22" r="8" fill="none" stroke="#f2d34f" strokeWidth="1.4" />
      <path d="M24 7v30M9 22h30M13.5 11.5l21 21M34.5 11.5l-21 21" stroke="#c9ced9" strokeWidth="1.2" />
      {[[24, 7, '#9a7bff'], [39, 22, '#4fae6b'], [24, 37, '#f27da5'], [9, 22, '#f2d34f'], [34.5, 11.5, '#6cc3e8'], [34.5, 32.5, '#e4553f'], [13.5, 32.5, '#4fae6b'], [13.5, 11.5, '#f27da5']].map(([x, y, c]) => (
        <circle key={`${x}-${y}`} cx={x as number} cy={y as number} r="2.4" fill={c as string} />
      ))}
      <circle cx="24" cy="22" r="2.2" fill="#8a93a8" />
    </>
  ),
  blossom: (
    <>
      {SHADOW}
      <rect x="22" y="24" width="4" height="17" fill="#8a5a3a" />
      <circle cx="24" cy="18" r="11" fill="#f6a8c4" />
      <circle cx="16" cy="22" r="6.5" fill="#f9bdd2" />
      <circle cx="32" cy="22" r="6.5" fill="#f9bdd2" />
      <circle cx="21" cy="14" r="2" fill="#fff" opacity="0.7" />
      <circle cx="29" cy="19" r="1.6" fill="#fff" opacity="0.7" />
    </>
  ),
  lemonade: (
    <>
      {SHADOW}
      <rect x="10" y="26" width="28" height="15" rx="1.5" fill="#f6dc6b" />
      <path d="M7 15h34l-3 11H10z" fill="#f2b632" />
      <path d="M13 15l-1.5 11M20 15l-.6 11M27 15l.6 11M34 15l1.5 11" stroke="#fff" strokeWidth="2.2" />
      <ellipse cx="24" cy="33" rx="5" ry="3.4" fill="#f9ec7a" />
      <path d="M21 33h6" stroke="#8fae2a" strokeWidth="1.2" />
    </>
  ),
  pumpkin: (
    <>
      {SHADOW}
      <ellipse cx="17" cy="33" rx="9" ry="7.5" fill="#f0842c" />
      <ellipse cx="31" cy="34" rx="7" ry="6" fill="#e5701f" />
      <path d="M13 27c-2 4-2 11 0 13M21 27c2 4 2 11 0 13M29 30c-1.5 3-1.5 8 0 9" stroke="#c75a14" strokeWidth="1.2" fill="none" />
      <rect x="15.5" y="22" width="3" height="5" rx="1" fill="#5c8a3a" />
      <rect x="29.5" y="26" width="2.6" height="4" rx="1" fill="#5c8a3a" />
    </>
  ),
  snowman: (
    <>
      {SHADOW}
      <circle cx="24" cy="34" r="8" fill="#f4f8ff" />
      <circle cx="24" cy="23" r="6" fill="#f4f8ff" />
      <rect x="19" y="12" width="10" height="6" rx="1" fill="#3a3550" />
      <rect x="17" y="17" width="14" height="2" rx="1" fill="#3a3550" />
      <circle cx="22" cy="22" r="0.9" fill="#222" />
      <circle cx="26" cy="22" r="0.9" fill="#222" />
      <polygon points="24,24 29,25 24,26" fill="#f0842c" />
      <path d="M19 28q5 3 10 0" stroke="#e4553f" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </>
  ),
  observatory: (
    <>
      {SHADOW}
      <rect x="12" y="24" width="24" height="17" rx="2" fill="#d8d2c4" />
      <path d="M10 25a14 13 0 0 1 28 0z" fill="#5d6f9e" />
      <path d="M22 13h4v12h-4z" fill="#3f4d75" />
      <path d="M26 15l9-6 2 3-9 6z" fill="#c9a44a" stroke="#8a6a20" strokeWidth="0.6" />
      <rect x="20" y="31" width="8" height="10" rx="4" fill="#4a3a2e" />
      <circle cx="16" cy="8" r="1" fill="#fff6c9" />
      <circle cx="40" cy="20" r="0.8" fill="#fff6c9" />
    </>
  ),
  bathhouse: (
    <>
      {SHADOW}
      <rect x="8" y="22" width="32" height="19" rx="2" fill="#e9d9b8" />
      <path d="M6 23L24 12l18 11z" fill="#a8452f" />
      <rect x="12" y="28" width="24" height="9" rx="4" fill="#6fc3d9" />
      <path d="M17 26q-2-3 0-6 M24 26q-2-3 0-6 M31 26q-2-3 0-6" stroke="#fff" strokeWidth="1.4" fill="none" opacity="0.85" />
      <rect x="21" y="35" width="6" height="6" fill="#7a4f22" />
    </>
  ),
  guildhall: (
    <>
      {SHADOW}
      <rect x="8" y="18" width="32" height="23" rx="1.5" fill="#cfa77a" />
      <path d="M6 19L24 6l18 13z" fill="#5b3a63" />
      <rect x="20" y="30" width="8" height="11" rx="1" fill="#5a3b20" />
      <rect x="11" y="22" width="6" height="6" fill="#ffe7a3" stroke="#7a5230" />
      <rect x="31" y="22" width="6" height="6" fill="#ffe7a3" stroke="#7a5230" />
      <path d="M24 9v-5l6 2-6 2" fill="#d9b14a" stroke="#8a6a20" strokeWidth="0.6" />
      <rect x="11" y="31" width="6" height="5" fill="#ffe7a3" stroke="#7a5230" />
      <rect x="31" y="31" width="6" height="5" fill="#ffe7a3" stroke="#7a5230" />
    </>
  ),
};

export function BuildingArt({ type, size = 44 }: { type: BuildingId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {ART[type]}
    </svg>
  );
}

// ---------------------------------------------------------- residents

interface Look {
  fur: string;
  face: string;
  ears: 'point' | 'round' | 'long' | 'tuft' | 'none';
  extra?: ReactElement;
}

const LOOKS: Record<RosterEntry['species'], Look> = {
  fox: { fur: '#e2793a', face: '#fff3e0', ears: 'point' },
  hedgehog: { fur: '#8b6f5a', face: '#ecd2b0', ears: 'round', extra: <path d="M8 22l3-8 3 5 4-8 4 6 4-6 4 8 3-5 3 8" stroke="#5e4a3b" strokeWidth="3" fill="none" strokeLinejoin="round" /> },
  owl: { fur: '#9a7b5b', face: '#f0e2c8', ears: 'tuft', extra: <><circle cx="14.5" cy="22" r="5" fill="#fff" /><circle cx="25.5" cy="22" r="5" fill="#fff" /></> },
  otter: { fur: '#8a6a4f', face: '#e8d5bd', ears: 'round' },
  gardener: { fur: '#f0c8a0', face: '#f0c8a0', ears: 'none', extra: <><ellipse cx="20" cy="14" rx="15" ry="3.4" fill="#e8c872" /><path d="M11 14a9 7 0 0 1 18 0z" fill="#d9b55a" /><rect x="11" y="12" width="18" height="2.2" fill="#6b9d4a" /></> },
  bear: { fur: '#7a5230', face: '#d9b48c', ears: 'round' },
  rabbit: { fur: '#f1ece4', face: '#fff', ears: 'long' },
  frog: { fur: '#6fb36f', face: '#c9e8b8', ears: 'none', extra: <><circle cx="12.5" cy="13" r="4.6" fill="#6fb36f" /><circle cx="27.5" cy="13" r="4.6" fill="#6fb36f" /><circle cx="12.5" cy="13" r="2.3" fill="#fff" /><circle cx="27.5" cy="13" r="2.3" fill="#fff" /></> },
  cat: { fur: '#c8c3bb', face: '#f4f1ec', ears: 'point', extra: <path d="M6 26h6M6 29l6-1M34 26h-6M34 29l-6-1" stroke="#7d786f" strokeWidth="1" /> },
  dragon: { fur: '#5fae6e', face: '#d8efc0', ears: 'none', extra: <><polygon points="10,14 7,3 15,11" fill="#e9c46a" /><polygon points="30,14 33,3 25,11" fill="#e9c46a" /><path d="M16 11l2-4 2 4 2-4 2 4" fill="#3f7f4c" /><circle cx="17.5" cy="28" r="0.8" fill="#2a2438" /><circle cx="22.5" cy="28" r="0.8" fill="#2a2438" /></> },
  unicorn: { fur: '#f6f1fb', face: '#fff', ears: 'point', extra: <><polygon points="20,1 17.5,12 22.5,12" fill="#f3c556" stroke="#c99a2e" strokeWidth="0.6" /><path d="M8 18q-2 -8 6 -12q-2 6 -1 10z" fill="#c9a6ef" /><path d="M32 18q2 -8 -6 -12q2 6 1 10z" fill="#9fd3f0" /></> },
  griffin: { fur: '#d9a95b', face: '#f3e2bd', ears: 'tuft', extra: <path d="M8 18q12 -10 24 0q-12 -4 -24 0z" fill="#8a5a2b" /> },
  mayor: { fur: '#e3b48c', face: '#e3b48c', ears: 'none', extra: <><rect x="13" y="3" width="14" height="10" rx="1.5" fill="#2f2a47" /><rect x="9" y="12" width="22" height="3" rx="1.5" fill="#2f2a47" /><rect x="13" y="10" width="14" height="2" fill="#e4553f" /><path d="M13 29q7 4 14 0q-3 -2.5 -7 -1.5q-4 -1 -7 1.5z" fill="#4a3a2e" /></> },
};

export function ResidentFace({ species, size = 48 }: { species: RosterEntry['species']; size?: number }) {
  const look = LOOKS[species];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      {look.ears === 'point' && (
        <>
          <polygon points="8,18 10,4 18,12" fill={look.fur} />
          <polygon points="32,18 30,4 22,12" fill={look.fur} />
        </>
      )}
      {look.ears === 'round' && (
        <>
          <circle cx="9" cy="12" r="5" fill={look.fur} />
          <circle cx="31" cy="12" r="5" fill={look.fur} />
        </>
      )}
      {look.ears === 'long' && (
        <>
          <ellipse cx="14" cy="8" rx="3.6" ry="9" fill={look.fur} />
          <ellipse cx="26" cy="8" rx="3.6" ry="9" fill={look.fur} />
          <ellipse cx="14" cy="8" rx="1.6" ry="6" fill="#f6b3c4" />
          <ellipse cx="26" cy="8" rx="1.6" ry="6" fill="#f6b3c4" />
        </>
      )}
      {look.ears === 'tuft' && (
        <>
          <polygon points="9,16 8,5 17,11" fill={look.fur} />
          <polygon points="31,16 32,5 23,11" fill={look.fur} />
        </>
      )}
      <circle cx="20" cy="23" r="13" fill={look.fur} />
      {species !== 'owl' && species !== 'gardener' && species !== 'mayor' && species !== 'frog' && species !== 'griffin' && <ellipse cx="20" cy="28" rx="8" ry="6" fill={look.face} />}
      {look.extra}
      <circle cx="14.5" cy="22" r={species === 'owl' ? 2.4 : 1.7} fill="#2a2438" />
      <circle cx="25.5" cy="22" r={species === 'owl' ? 2.4 : 1.7} fill="#2a2438" />
      {species === 'owl' || species === 'griffin' ? <polygon points="20,25 17.5,29 22.5,29" fill="#f0a23a" /> : species === 'dragon' ? <path d="M15 31q5 3 10 0" stroke="#2f5f3a" strokeWidth="1.4" fill="none" strokeLinecap="round" /> : species === 'frog' ? <path d="M14 29q6 4 12 0" stroke="#3b6f3b" strokeWidth="1.5" fill="none" strokeLinecap="round" /> : species === 'mayor' || species === 'gardener' ? <path d="M16.5 30q3.5 2.5 7 0" stroke="#7a4a3a" strokeWidth="1.4" fill="none" strokeLinecap="round" /> : <ellipse cx="20" cy="26.5" rx="2.2" ry="1.6" fill="#2a2438" />}
    </svg>
  );
}

/** Original portrait for Rohld, the slate-and-rust travelling penguin. */
export function RohldFace({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <ellipse cx="20" cy="35.5" rx="13" ry="2.5" fill="#263c3b" opacity=".16" />
      <path d="M13 13 12 5l6 5M26 12l3-7 2 9" fill="#61798b" stroke="#465c6a" strokeWidth="1" strokeLinejoin="round" />
      <ellipse cx="20" cy="23" rx="13" ry="14" fill="#61798b" />
      <ellipse cx="20" cy="27" rx="8.5" ry="8" fill="#f3ead6" />
      <ellipse cx="14.7" cy="20.3" rx="3.1" ry="3.6" fill="#fff8e8" />
      <ellipse cx="25.3" cy="20.3" rx="3.1" ry="3.6" fill="#fff8e8" />
      <circle cx="15" cy="20.5" r="1.55" fill="#293943" />
      <circle cx="25" cy="20.5" r="1.55" fill="#293943" />
      <path d="m17 24 3-2 3 2-3 2z" fill="#dfaa63" />
      <path d="M7 27q13 4 26 0v4q-13 4-26 0z" fill="#c77755" />
      <path d="m25 29 4 1-1 7-4-1z" fill="#c77755" />
      <path d="m12 29 4 6-2 1-5-6z" fill="#dfc18e" />
      <rect x="25" y="31" width="7" height="5" rx="1.5" fill="#b4865f" />
      <path d="M27 32h3" stroke="#e2c888" strokeWidth="1" />
    </svg>
  );
}
