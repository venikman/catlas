const ICON_PATHS = {
  back: "M15 18l-6-6 6-6",
  close: "M6 6l12 12M18 6L6 18",
  zoom: "M11 19a8 8 0 1 1 5.6-13.7A8 8 0 0 1 11 19zM21 21l-4.3-4.3M11 8v6M8 11h6",
  search: "M11 19a8 8 0 1 1 5.6-13.7A8 8 0 0 1 11 19zM21 21l-4.3-4.3",
  filter: "M3 5h18l-7 8v5l-4 2v-7L3 5z",
  lasso: "M6 9c4-5 15-3 14 3-1 6-15 7-17 2-1-2 0-4 3-5zM10 17c2 4 7 5 10 2",
  tag: "M20 13l-7 7-10-10V3h7l10 10zM7.5 7.5h.01",
  pin: "M12 3l6 6-4 4v5l-2 2-2-2v-5L6 9l6-6z",
  table: "M3 4h18v16H3zM3 10h18M9 4v16",
  download: "M12 3v12M12 15l-5-5M12 15l5-5M5 21h14",
  more: "M12 6h.01M12 12h.01M12 18h.01",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  locate: "M12 2v4M12 18v4M2 12h4M18 12h4M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
} as const;

export type AtlasIconName = keyof typeof ICON_PATHS;

export function AtlasIcon({
  name,
  size = 18,
  className = "",
}: {
  name: AtlasIconName;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`atlas-icon inline-flex ${className}`}>
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={ICON_PATHS[name]} />
      </svg>
    </span>
  );
}
