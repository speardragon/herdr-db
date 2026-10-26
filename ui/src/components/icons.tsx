import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export function CaretIcon({ open, ...rest }: IconProps & { open: boolean }) {
  return (
    <Svg size={12} {...rest}>
      <path d={open ? 'M4 6l4 4 4-4' : 'M6 4l4 4-4 4'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3 10.5V3.5A1 1 0 014 2.5h6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M6.83 3.14 L7.12 1.46 L8.88 1.46 L9.17 3.14 L10.61 3.74 L12 2.75 L13.25 4 L12.26 5.39 L12.86 6.83 L14.54 7.12 L14.54 8.88 L12.86 9.17 L12.26 10.61 L13.25 12 L12 13.25 L10.61 12.26 L9.17 12.86 L8.88 14.54 L7.12 14.54 L6.83 12.86 L5.39 12.26 L4 13.25 L2.75 12 L3.74 10.61 L3.14 9.17 L1.46 8.88 L1.46 7.12 L3.14 6.83 L3.74 5.39 L2.75 4 L4 2.75 L5.39 3.74 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
    </Svg>
  );
}

export function LeafIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M8.3 1.5c.1 0 3.6 3.1 3.6 7 0 3.2-2.3 4.9-3.2 5.4l-.2 1.6h-1l-.2-1.6c-.9-.5-3.2-2.2-3.2-5.4 0-3.9 3.6-7 3.7-7z"
        fill="currentColor"
      />
    </Svg>
  );
}
