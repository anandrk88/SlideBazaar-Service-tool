import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 40,
  height: 40,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const BulbIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
  </svg>
);
export const BroomIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M19 3 10.5 11.5M10.5 11.5 4 18c0 2 1 3 3 3l6.5-6.5M10.5 11.5l2 2" />
  </svg>
);
export const PaletteIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 3 0 4-1c1.5-1.5 1-3 1-4a9 9 0 0 0-7-8Z" />
    <circle cx="7.5" cy="12" r="1" />
    <circle cx="9.5" cy="8" r="1" />
    <circle cx="14" cy="7.5" r="1" />
  </svg>
);
export const PencilIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m4 20 4-1L20 7l-3-3L5 16l-1 4ZM14 6l3 3" />
  </svg>
);
export const SearchIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </svg>
);
export const EditIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 15 1-3 5-5 2 2-5 5-3 1Z" />
  </svg>
);
export const NoneIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.6 5.6 12.8 12.8" />
  </svg>
);
export const UploadIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 16V4m0 0-4 4m4-4 4 4M4 20h16" />
  </svg>
);
export const CheckIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m5 12 5 5L20 7" />
  </svg>
);
export const LockIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
export const FileIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
  </svg>
);

export const GridIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
export const ListIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);
export const TasksIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m3 7 2 2 4-4M3 17l2 2 4-4M12 7h9M12 17h9" />
  </svg>
);
export const ShieldCheckIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
export const UsersIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" />
  </svg>
);
export const CalendarIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

export const MessageIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 5h16v11H8l-4 4V5Z" />
    <path d="M8 9h8M8 12h5" />
  </svg>
);
export const InboxIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 4h16v16H4zM4 14h4l2 3h4l2-3h4" />
  </svg>
);
export const TagIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 12V4h8l10 10-8 8L3 12Z" />
    <circle cx="8" cy="9" r="1.5" />
  </svg>
);
export const BellIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2ZM10 20a2 2 0 0 0 4 0" />
  </svg>
);
export const ChevronDownIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export function TreatmentIcon({ icon, className, width = 44, height = 44 }: { icon: string; className?: string; width?: number; height?: number }) {
  const props = { className, width, height };
  switch (icon) {
    case "bulb":
      return <BulbIcon {...props} />;
    case "broom":
      return <BroomIcon {...props} />;
    case "palette":
      return <PaletteIcon {...props} />;
    case "pencil":
      return <PencilIcon {...props} />;
    case "search":
      return <SearchIcon {...props} />;
    case "edit":
      return <EditIcon {...props} />;
    default:
      return <NoneIcon {...props} />;
  }
}
