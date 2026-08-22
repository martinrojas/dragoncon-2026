import React, { type JSX } from "react";

/* Lucide glyph geometry for pure inline SVG icons */
const GLYPHS: Record<string, string> = {
  "arrow-left": '<path d="m12 19-7-7 7-7"></path> <path d="M19 12H5"></path>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"></path> <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path>',
  "bookmark-check":
    '<path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"></path> <path d="m9 10 2 2 4-4"></path>',
  bookmark:
    '<path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"></path>',
  "calendar-clock":
    '<path d="M16 14v2.2l1.6 1"></path> <path d="M16 2v3"></path> <path d="M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338"></path> <path d="M3 9h5.859"></path> <path d="M8 2v3"></path> <circle cx="16" cy="16" r="6"></circle>',
  check: '<path d="M20 6 9 17l-5-5"></path>',
  "chevron-down": '<path d="m6 9 6 6 6-6"></path>',
  "chevron-right": '<path d="m9 18 6-6-6-6"></path>',
  clock: '<circle cx="12" cy="12" r="10"></circle> <path d="M12 6v6l4 2"></path>',
  download:
    '<path d="M12 15V3"></path> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path> <path d="m7 10 5 5 5-5"></path>',
  footprints:
    '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"></path> <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"></path> <path d="M16 17h4"></path> <path d="M4 13h4"></path>',
  inbox:
    '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline> <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>',
  info: '<circle cx="12" cy="12" r="10"></circle> <path d="M12 16v-4"></path> <path d="M12 8h.01"></path>',
  "log-out":
    '<path d="m16 17 5-5-5-5"></path> <path d="M21 12H9"></path> <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>',
  "map-pin":
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path> <circle cx="12" cy="10" r="3"></circle>',
  map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"></path> <path d="M15 5.764v15"></path> <path d="M9 3.236v15"></path>',
  "octagon-alert":
    '<path d="M12 16h.01"></path> <path d="M12 8v4"></path> <path d="M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z"></path>',
  plus: '<path d="M5 12h14"></path> <path d="M12 5v14"></path>',
  "qr-code":
    '<rect width="5" height="5" x="3" y="3" rx="1"></rect> <rect width="5" height="5" x="16" y="3" rx="1"></rect> <rect width="5" height="5" x="3" y="16" rx="1"></rect> <path d="M21 16h-3a2 2 0 0 0-2 2v3"></path> <path d="M21 21v.01"></path> <path d="M12 7v3a2 2 0 0 1-2 2H7"></path> <path d="M3 12h.01"></path> <path d="M12 3h.01"></path> <path d="M12 16v.01"></path> <path d="M16 12h1"></path> <path d="M21 12v.01"></path> <path d="M12 21v-1"></path>',
  "refresh-cw":
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path> <path d="M21 3v5h-5"></path> <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path> <path d="M8 16H3v5"></path>',
  search: '<path d="m21 21-4.34-4.34"></path> <circle cx="11" cy="11" r="8"></circle>',
  "share-2":
    '<circle cx="18" cy="5" r="3"></circle> <circle cx="6" cy="12" r="3"></circle> <circle cx="18" cy="19" r="3"></circle> <line x1="8.59" x2="15.42" y1="13.51" y2="17.49"></line> <line x1="15.41" x2="8.59" y1="6.51" y2="10.49"></line>',
  "sliders-horizontal":
    '<path d="M10 5H3"></path> <path d="M12 19H3"></path> <path d="M14 3v4"></path> <path d="M16 17v4"></path> <path d="M21 12h-9"></path> <path d="M21 19h-5"></path> <path d="M21 5h-7"></path> <path d="M8 10v4"></path> <path d="M8 12H3"></path>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path>',
  "triangle-alert":
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path> <path d="M12 9v4"></path> <path d="M12 17h.01"></path>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path> <circle cx="12" cy="7" r="4"></circle>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path> <path d="M16 3.128a4 4 0 0 1 0 7.744"></path> <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path> <circle cx="9" cy="7" r="4"></circle>',
  x: '<path d="M18 6 6 18"></path> <path d="m6 6 12 12"></path>',
};

export function Icon({
  name,
  size = 18,
  color = "currentColor",
  style,
  ...rest
}: {
  name: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}): JSX.Element {
  const inner = GLYPHS[name];
  if (!inner) {
    return (
      <span
        aria-hidden="true"
        style={{ display: "inline-block", width: size, height: size, flex: "0 0 auto", ...style }}
      />
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: inner }}
      {...rest}
      style={{ display: "inline-block", flex: "0 0 auto", ...style }}
    />
  );
}

export function IconButton({
  icon,
  label,
  size = "md",
  variant = "ghost",
  active = false,
  disabled = false,
  onClick,
  style,
  ...rest
}: {
  icon: string;
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "outline";
  active?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  style?: React.CSSProperties;
}): JSX.Element {
  const [hover, setHover] = React.useState(false);
  const d = size === "sm" ? 32 : size === "lg" ? 44 : 40;
  const bordered = variant === "outline";
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: d,
        height: d,
        padding: 0,
        color: disabled
          ? "var(--text-disabled)"
          : active
          ? "var(--gold-500)"
          : hover
          ? "var(--text-primary)"
          : "var(--text-secondary)",
        background: active
          ? "var(--signal-quiet)"
          : hover && !disabled
          ? "rgba(255,255,255,.05)"
          : "transparent",
        border: "1px solid " + (bordered ? "var(--line-subtle)" : active ? "var(--line-gold)" : "transparent"),
        borderRadius: "var(--r-control)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "var(--t-control)",
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
    >
      <Icon name={icon} size={size === "sm" ? 16 : 18} />
    </button>
  );
}

export function AppBar({
  title,
  eyebrow,
  left,
  right = [],
  style,
}: {
  title: string;
  eyebrow?: string;
  left?: { icon: string; label: string; onClick?: () => void };
  right?: Array<{ icon: string; label: string; active?: boolean; onClick?: () => void }>;
  style?: React.CSSProperties;
}): JSX.Element {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: "var(--appbar-h)",
        padding: "0 12px 0 " + (left ? "6px" : "16px"),
        background: "var(--surface-glass-strong)",
        backdropFilter: "var(--blur-bar)",
        WebkitBackdropFilter: "var(--blur-bar)",
        borderBottom: "1px solid var(--line-hairline)",
        boxShadow: "var(--inner-lip)",
        ...style,
      }}
    >
      {left && <IconButton icon={left.icon} label={left.label} onClick={left.onClick} />}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        {eyebrow && (
          <span
            style={{
              font: "var(--type-micro)",
              letterSpacing: "var(--ls-label)",
              textTransform: "uppercase",
              color: "var(--gold-500)",
            }}
          >
            {eyebrow}
          </span>
        )}
        <span
          style={{
            font: "var(--fw-bold) var(--fs-subhead)/1.2 var(--font-core)",
            letterSpacing: "var(--ls-heading)",
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {right.map((r, i) => (
          <IconButton key={i} icon={r.icon} label={r.label} active={r.active} onClick={r.onClick} />
        ))}
      </div>
    </header>
  );
}

export interface DayItem {
  value: string;
  label: string;
  date: string;
  count?: number;
}

export function DayStrip({
  days = [],
  value,
  onChange,
  style,
}: {
  days: DayItem[];
  value: string;
  onChange?: (val: string) => void;
  style?: React.CSSProperties;
}): JSX.Element {
  return (
    <div
      className="cd-scroll"
      style={{
        display: "flex",
        gap: 6,
        padding: "10px var(--gutter)",
        overflowX: "auto",
        ...style,
      }}
    >
      {days.map((d) => {
        const on = d.value === value;
        return (
          <button
            key={d.value}
            onClick={() => onChange && onChange(d.value)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              minWidth: 54,
              padding: "7px 0 8px",
              flex: "0 0 auto",
              background: on ? "var(--grad-brand)" : "rgba(255,255,255,.03)",
              border: "1px solid " + (on ? "transparent" : "var(--line-hairline)"),
              borderRadius: "var(--r-2)",
              boxShadow: on ? "var(--inner-lip)" : "none",
              cursor: "pointer",
              transition: "var(--t-control)",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span
              style={{
                font: "var(--type-micro)",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: on ? "rgba(255,255,255,.85)" : "var(--text-tertiary)",
              }}
            >
              {d.label}
            </span>
            <span
              style={{
                font: "var(--fw-bold) var(--fs-subhead)/1 var(--font-core)",
                fontVariantNumeric: "tabular-nums",
                color: on ? "#fff" : "var(--text-primary)",
              }}
            >
              {d.date}
            </span>
            {d.count != null && (
              <span
                style={{
                  font: "var(--type-micro)",
                  color: on ? "rgba(255,255,255,.8)" : "var(--purple-300)",
                }}
              >
                {d.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedControl({
  options = [],
  value,
  onChange,
  size = "md",
  style,
}: {
  options: string[] | Array<{ value: string; label: string }>;
  value: string;
  onChange?: (val: string) => void;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}): JSX.Element {
  const h = size === "sm" ? 30 : 38;
  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex",
        padding: 2,
        background: "var(--surface-inset)",
        border: "1px solid var(--line-hairline)",
        borderRadius: "var(--r-2)",
        boxShadow: "var(--inner-frame)",
        ...style,
      }}
    >
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        const on = v === value;
        return (
          <button
            key={v}
            role="tab"
            aria-selected={on}
            onClick={() => onChange && onChange(v)}
            style={{
              height: h,
              padding: "0 14px",
              font:
                "var(--fw-semibold) " +
                (size === "sm" ? "var(--fs-body-sm)" : "var(--fs-body)") +
                "/1 var(--font-core)",
              color: on ? "var(--text-primary)" : "var(--text-tertiary)",
              background: on ? "var(--grey-700)" : "transparent",
              border: "1px solid " + (on ? "var(--line-subtle)" : "transparent"),
              borderRadius: "var(--r-1)",
              boxShadow: on ? "var(--inner-lip)" : "none",
              cursor: "pointer",
              transition: "var(--t-control)",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

const TONES: Record<string, { fg: string; bg: string; bd: string }> = {
  live: { fg: "#fff", bg: "var(--coral-500)", bd: "transparent" },
  soon: { fg: "var(--text-on-gold)", bg: "var(--gold-500)", bd: "transparent" },
  saved: { fg: "var(--purple-200)", bg: "var(--accent-quiet)", bd: "var(--line-purple)" },
  neutral: { fg: "var(--text-secondary)", bg: "rgba(255,255,255,.06)", bd: "var(--line-subtle)" },
  ok: { fg: "var(--jade-500)", bg: "rgba(47,191,143,.12)", bd: "rgba(47,191,143,.4)" },
  done: { fg: "var(--text-tertiary)", bg: "transparent", bd: "var(--line-subtle)" },
};

export function Badge({
  children,
  tone = "neutral",
  dot = false,
  style,
}: {
  children: React.ReactNode;
  tone?: "live" | "soon" | "saved" | "neutral" | "ok" | "done";
  dot?: boolean;
  style?: React.CSSProperties;
}): JSX.Element {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 20,
        padding: "0 7px",
        font: "var(--type-micro)",
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: t.fg,
        background: t.bg,
        border: "1px solid " + t.bd,
        borderRadius: "var(--r-pill)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "currentColor",
            boxShadow: tone === "live" ? "0 0 6px currentColor" : "none",
          }}
        />
      )}
      {children}
    </span>
  );
}

export function Tag({
  children,
  accent,
  removable = false,
  onRemove,
  selected = false,
  onClick,
  style,
}: {
  children: React.ReactNode;
  accent?: string;
  removable?: boolean;
  onRemove?: (e: React.MouseEvent) => void;
  selected?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}): JSX.Element {
  const [hover, setHover] = React.useState(false);
  const bar = accent || "var(--purple-400)";
  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 24,
        padding: "0 8px 0 0",
        font: "var(--type-label)",
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: selected ? "var(--text-primary)" : "var(--text-secondary)",
        background: selected
          ? "rgba(255,255,255,.08)"
          : hover
          ? "rgba(255,255,255,.05)"
          : "rgba(255,255,255,.03)",
        border: "1px solid " + (selected ? "var(--line-strong)" : "var(--line-hairline)"),
        borderRadius: "var(--r-1)",
        clipPath: "var(--clip-tag)",
        cursor: onClick ? "pointer" : "default",
        transition: "var(--t-control)",
        ...style,
      }}
    >
      <span style={{ width: 3, alignSelf: "stretch", background: bar, marginRight: 5 }} />
      {children}
      {removable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove && onRemove(e);
          }}
          aria-label="Remove"
          style={{
            display: "inline-flex",
            width: 14,
            height: 14,
            marginLeft: 1,
            padding: 0,
            alignItems: "center",
            justifyContent: "center",
            font: "var(--type-micro)",
            color: "var(--text-tertiary)",
            background: "transparent",
            border: 0,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      )}
    </span>
  );
}

export function TimeRail({
  label,
  children,
  active = false,
  style,
}: {
  label: string;
  children: React.ReactNode;
  active?: boolean;
  style?: React.CSSProperties;
}): JSX.Element {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "var(--rail-w) 1fr",
        ...style,
      }}
    >
      <div style={{ position: "relative", paddingTop: 2 }}>
        <span
          style={{
            font: "var(--type-label)",
            letterSpacing: ".1em",
            color: active ? "var(--gold-500)" : "var(--text-tertiary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {label}
        </span>
        <span
          style={{
            position: "absolute",
            top: 20,
            bottom: -10,
            left: 3,
            width: 1,
            background: active ? "var(--line-gold)" : "var(--line-hairline)",
          }}
        />
        {active && (
          <span
            style={{
              position: "absolute",
              top: 20,
              left: 0,
              width: 7,
              height: 7,
              background: "var(--gold-500)",
              boxShadow: "0 0 8px var(--gold-500)",
            }}
          />
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--module-gap)",
          paddingBottom: "var(--s-8)",
        }}
      >
        {children}
      </div>
    </section>
  );
}

export function PanelCard({
  time,
  endTime,
  title,
  venue,
  room,
  track,
  trackColor = "var(--purple-400)",
  status,
  saved = false,
  conflict = false,
  walk,
  onSave,
  onClick,
  style,
}: {
  time: string;
  endTime?: string;
  title: string;
  venue?: string;
  room?: string;
  track?: string;
  trackColor?: string;
  status?: "live" | "soon" | "done" | "upcoming";
  saved?: boolean;
  conflict?: boolean;
  walk?: string;
  onSave?: () => void;
  onClick?: () => void;
  style?: React.CSSProperties;
}): JSX.Element {
  const [hover, setHover] = React.useState(false);
  const live = status === "live";
  return (
    <article
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "58px 1fr auto",
        gap: 12,
        padding: "12px 12px 12px 10px",
        background: hover ? "rgba(36,40,47,.7)" : "var(--surface-glass)",
        backdropFilter: "var(--blur-panel)",
        WebkitBackdropFilter: "var(--blur-panel)",
        border:
          "1px solid " +
          (live
            ? "var(--line-gold)"
            : conflict
            ? "rgba(229,72,77,.35)"
            : "var(--line-hairline)"),
        borderRadius: "var(--r-panel)",
        boxShadow: live
          ? "var(--inner-lip), var(--glow-gold)"
          : "var(--inner-lip), var(--shadow-1)",
        cursor: onClick ? "pointer" : "default",
        transition: "var(--t-control)",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          paddingTop: 1,
          borderLeft: "2px solid " + trackColor,
          paddingLeft: 8,
          marginLeft: -2,
        }}
      >
        <span
          style={{
            font: "var(--fw-bold) var(--fs-body)/1.1 var(--font-mono)",
            fontVariantNumeric: "tabular-nums",
            color: live ? "var(--gold-500)" : "var(--text-primary)",
          }}
        >
          {time}
        </span>
        {endTime && (
          <span
            style={{
              font: "var(--type-micro)",
              color: "var(--text-tertiary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {endTime}
          </span>
        )}
      </div>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {status === "live" && (
            <Badge tone="live" dot>
              Live
            </Badge>
          )}
          {status === "soon" && <Badge tone="soon">Soon</Badge>}
          {status === "done" && <Badge tone="done">Ended</Badge>}
          {conflict && <Badge tone="live">Conflict</Badge>}
        </div>
        <h3
          style={{
            margin: 0,
            font: "var(--fw-semibold) var(--fs-body)/1.3 var(--font-core)",
            letterSpacing: "-.005em",
            color: "var(--text-primary)",
            textWrap: "pretty",
          }}
        >
          {title}
        </h3>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            columnGap: 5,
            rowGap: 3,
            font: "var(--type-micro)",
            letterSpacing: ".06em",
            color: "var(--text-tertiary)",
          }}
        >
          <Icon name="map-pin" size={11} />
          <span style={{ textTransform: "uppercase" }}>{venue || "VENUE TBD"}</span>
          {room && (
            <>
              <span style={{ opacity: 0.4 }}>/</span>
              <span style={{ textTransform: "uppercase" }}>{room}</span>
            </>
          )}
          {walk && (
            <>
              <span style={{ opacity: 0.4 }}>/</span>
              <Icon name="footprints" size={11} />
              <span>{walk}</span>
            </>
          )}
        </div>
        {track && (
          <div>
            <Tag accent={trackColor}>{track}</Tag>
          </div>
        )}
      </div>
      {onSave && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          aria-label={saved ? "Remove from schedule" : "Add to schedule"}
          style={{
            alignSelf: "flex-start",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            color: saved ? "var(--gold-500)" : "var(--text-tertiary)",
            background: saved ? "var(--signal-quiet)" : "transparent",
            border: "1px solid " + (saved ? "var(--line-gold)" : "var(--line-subtle)"),
            borderRadius: "var(--r-control)",
            cursor: "pointer",
            transition: "var(--t-control)",
          }}
        >
          <Icon name={saved ? "bookmark-check" : "bookmark"} size={16} />
        </button>
      )}
    </article>
  );
}
