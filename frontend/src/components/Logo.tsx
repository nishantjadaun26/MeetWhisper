import React from 'react';

interface LogoProps {
  isDark?: boolean;
  showTagline?: boolean;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const LogoIcon: React.FC<{ isDark?: boolean; size?: number; className?: string }> = ({
  isDark = true,
  size = 28,
  className = '',
}) => {
  const gradientId = isDark ? 'mw-grad-dark' : 'mw-grad-light';
  const dotColor = isDark ? '#67E8F9' : '#0284C7';

  return (
    <svg
      width={size}
      height={(size * 85) / 100}
      viewBox="0 0 100 85"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      <defs>
        {isDark ? (
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#C4B5FD" />
            <stop offset="42%" stopColor="#A78BFA" />
            <stop offset="68%" stopColor="#67E8F9" />
            <stop offset="100%" stopColor="#67E8F9" />
          </linearGradient>
        ) : (
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="40%" stopColor="#7C3AED" />
            <stop offset="70%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
        )}
      </defs>

      {/* Floating center beacon dot */}
      <circle cx="50" cy="13" r="6.5" fill={dotColor} />

      {/* Stylized rounded W stroke */}
      <path
        d="M 14 24 L 32 73 C 33 75.5 35 75.5 36.5 73 L 50 35 C 50.5 34 51.5 34 52 35 L 65.5 73 C 67 75.5 69 75.5 70 73 L 86 24"
        stroke={`url(#${gradientId})`}
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const Logo: React.FC<LogoProps> = ({
  isDark = true,
  showTagline = false,
  iconOnly = false,
  size = 'md',
  className = '',
}) => {
  const sizeMap = {
    sm: { icon: 20, text: 'text-sm', tagline: 'text-[7px]' },
    md: { icon: 26, text: 'text-base', tagline: 'text-[8.5px]' },
    lg: { icon: 34, text: 'text-xl', tagline: 'text-[10px]' },
    xl: { icon: 44, text: 'text-2xl', tagline: 'text-[12px]' },
  };

  const currentSize = sizeMap[size];

  if (iconOnly) {
    return <LogoIcon isDark={isDark} size={currentSize.icon} className={className} />;
  }

  return (
    <div className={`inline-flex flex-col select-none ${className}`}>
      <div className="flex items-center space-x-2.5">
        <LogoIcon isDark={isDark} size={currentSize.icon} />
        <span className={`font-sans font-bold tracking-tight ${currentSize.text} leading-none flex items-baseline`}>
          <span className={isDark ? 'text-[#F1EFFA]' : 'text-[#14121F]'}>Meet</span>
          <span className={isDark ? 'text-[#C4B5FD]' : 'text-[#6366F1]'}>Wh</span>
          <span className={isDark ? 'text-[#67E8F9]' : 'text-[#0284C7]'}>isper</span>
        </span>
      </div>

      {showTagline && (
        <span
          className={`font-mono uppercase tracking-[0.24em] font-medium mt-1 pl-[calc(${currentSize.icon}px+10px)] ${
            currentSize.tagline
          } ${isDark ? 'text-[#B3AFCB]/70' : 'text-[#64748B]'}`}
        >
          Verify Every Word
        </span>
      )}
    </div>
  );
};

export default Logo;
