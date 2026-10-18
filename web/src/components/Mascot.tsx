/** "Robo" — friendly cartoon robot head. Mood changes with connection state. */
export type Mood = 'sleep' | 'happy' | 'wow' | 'think' | 'sad';

export function Mascot({ mood = 'happy', size = 120, color = '#4F7CFF', className = '' }: { mood?: Mood; size?: number; color?: string; className?: string }) {
  const ink = '#23305A';
  const eye = (cx: number) => {
    switch (mood) {
      case 'sleep':
        return <path d={`M${cx - 9} 62 q9 7 18 0`} stroke={ink} strokeWidth="5" fill="none" strokeLinecap="round" />;
      case 'happy':
        return <path d={`M${cx - 9} 64 q9 -10 18 0`} stroke={ink} strokeWidth="5" fill="none" strokeLinecap="round" />;
      case 'wow':
        return (
          <g>
            <circle cx={cx} cy="61" r="10" fill={ink} />
            <circle cx={cx + 3} cy="57" r="3.5" fill="#fff" />
          </g>
        );
      case 'sad':
        return <circle cx={cx} cy="63" r="6" fill={ink} />;
      default:
        return (
          <g>
            <circle cx={cx} cy="61" r="7" fill={ink} />
            <circle cx={cx + 2} cy="58" r="2.5" fill="#fff" />
          </g>
        );
    }
  };
  const mouth =
    mood === 'wow' ? <ellipse cx="60" cy="86" rx="8" ry="9" fill={ink} /> :
    mood === 'sad' ? <path d="M48 90 q12 -10 24 0" stroke={ink} strokeWidth="5" fill="none" strokeLinecap="round" /> :
    mood === 'sleep' ? <path d="M52 86 h16" stroke={ink} strokeWidth="5" strokeLinecap="round" /> :
    mood === 'think' ? <path d="M50 87 q6 -4 12 0 t12 0" stroke={ink} strokeWidth="5" fill="none" strokeLinecap="round" /> :
    <path d="M45 82 q15 16 30 0" stroke={ink} strokeWidth="5" fill="#fff" strokeLinecap="round" strokeLinejoin="round" />;

  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} aria-hidden>
      {/* antenna */}
      <line x1="60" y1="22" x2="60" y2="8" stroke={ink} strokeWidth="5" strokeLinecap="round" />
      <circle cx="60" cy="8" r="7" fill={mood === 'sleep' ? '#8F9ABB' : '#FFC93C'} stroke={ink} strokeWidth="4" />
      {/* ears */}
      <rect x="6" y="48" width="14" height="30" rx="6" fill="#FFC93C" stroke={ink} strokeWidth="4" />
      <rect x="100" y="48" width="14" height="30" rx="6" fill="#FFC93C" stroke={ink} strokeWidth="4" />
      {/* head */}
      <rect x="16" y="22" width="88" height="86" rx="30" fill={color} stroke={ink} strokeWidth="5" />
      {/* face plate */}
      <rect x="26" y="38" width="68" height="62" rx="22" fill="#fff" stroke={ink} strokeWidth="4" />
      {eye(46)}
      {eye(74)}
      {/* cheeks */}
      {(mood === 'happy' || mood === 'wow') && (
        <>
          <ellipse cx="36" cy="78" rx="6" ry="4" fill="#FF8FA3" opacity="0.8" />
          <ellipse cx="84" cy="78" rx="6" ry="4" fill="#FF8FA3" opacity="0.8" />
        </>
      )}
      {mouth}
      {mood === 'sleep' && (
        <text x="92" y="34" fontSize="18" fontWeight="700" fill={ink} fontFamily="Fredoka, sans-serif">z</text>
      )}
    </svg>
  );
}
