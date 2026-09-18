/**
 * Иконите са вградени SVG, а не иконен шрифт или пакет — така темата ги
 * оцветява през `currentColor` и няма мрежова заявка при първо рисуване.
 */

export type IconName =
  | 'bullion'
  | 'card'
  | 'vault'
  | 'rate'
  | 'instant'
  | 'shield'
  | 'check'
  | 'arrow-down'
  | 'arrow-up'
  | 'logo';

interface IconProps {
  readonly name: IconName;
  readonly size?: number;
}

const paths: Record<IconName, React.ReactNode> = {
  bullion: (
    <>
      <path d="M4 16h16l-1.6-5H5.6L4 16Z" />
      <path d="M7 11l1.2-4h7.6L17 11" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
      <path d="M2.5 10h19" />
      <path d="M6.5 14.5h3" />
    </>
  ),
  vault: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 6v2M12 16v2M6 12h2M16 12h2" />
    </>
  ),
  rate: (
    <>
      <path d="M3 17l5.5-6 4 3.5L21 6" />
      <path d="M16 6h5v5" />
    </>
  ),
  instant: <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z" />,
  shield: (
    <>
      <path d="M12 3l7.5 3v6c0 4.2-3 7.7-7.5 9-4.5-1.3-7.5-4.8-7.5-9V6L12 3Z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </>
  ),
  check: <path d="M4.5 12.5 9 17l10.5-10.5" />,
  'arrow-down': (
    <>
      <path d="M12 5v13" />
      <path d="M6.5 12.5 12 18l5.5-5.5" />
    </>
  ),
  'arrow-up': (
    <>
      <path d="M12 19V6" />
      <path d="M6.5 11.5 12 6l5.5 5.5" />
    </>
  ),
  logo: (
    <>
      <path d="M12 2.5 21 19H3L12 2.5Z" />
      <path d="M12 9.5 16 17H8l4-7.5Z" />
    </>
  ),
};

export function Icon({ name, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
