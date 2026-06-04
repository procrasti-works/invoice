import type { SVGProps } from "react";

export function PayvioMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" {...props}>
      <defs>
        <mask
          id="payvio-mark-mask"
          maskUnits="userSpaceOnUse"
          maskContentUnits="userSpaceOnUse"
        >
          <rect width="32" height="32" fill="var(--mask-hide)" />
          <circle cx="16" cy="16" r="12.8" fill="var(--mask-show)" />
          <g
            transform="rotate(-45 16 16)"
            stroke="var(--mask-hide)"
            strokeLinecap="butt"
            strokeWidth="3.15"
          >
            <path d="M-4 8.8H36" />
            <path d="M-4 14.4H36" />
            <path d="M-4 20H36" />
          </g>
        </mask>
      </defs>
      <circle cx="16" cy="16" r="12.8" fill="currentColor" mask="url(#payvio-mark-mask)" />
    </svg>
  );
}
