import React from "react";

export function Icon({ name, size = 20 }) {
  const paths = {
    home: "M3 11.5 12 4l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
    chat: "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z",
    data: "M4 5c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2Zm0 0v6c0 1.1 3.6 2 8 2s8-.9 8-2V5M4 11v6c0 1.1 3.6 2 8 2s8-.9 8-2v-6",
    game: "M7 8h10a4 4 0 0 1 3.8 5.2l-1.7 5.3a2 2 0 0 1-3.3.8L13.5 17h-3l-2.3 2.3a2 2 0 0 1-3.3-.8l-1.7-5.3A4 4 0 0 1 7 8Zm1 4v4m-2-2h4m6-1h.01m2 2h.01",
    arena: "M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0ZM7 6H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4",
    train: "M6 3h12M9 3v5l-5 9a3 3 0 0 0 2.6 4.5h10.8A3 3 0 0 0 20 17l-5-9V3M7 15h10",
    cpu: "M9 9h6v6H9zM4 9h2m12 0h2M4 15h2m12 0h2M9 4v2m6-2v2M9 18v2m6-2v2M7 7h10v10H7z",
    download: "M12 3v12m0 0 5-5m-5 5-5-5M4 21h16",
    upload: "M12 16V4m0 0 5 5m-5-5-5 5M4 20h16",
    trash: "M4 7h16m-10 4v6m4-6v6M9 7l1-3h4l1 3m-8 0 1 14h8l1-14",
    send: "m3 3 18 9-18 9 4-9Zm4 9h14",
    stop: "M6 6h12v12H6z",
    check: "m5 12 4 4L19 6",
    close: "M6 6l12 12M18 6 6 18",
    spark: "m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z",
    edit: "m4 20 4.5-1L19 8.5a2.1 2.1 0 0 0-3-3L5.5 16Z",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.spark} />
    </svg>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  className = "",
  ...props
}) {
  return (
    <button className={`button ${variant} ${size} ${className}`} {...props}>
      {icon ? <Icon name={icon} size={size === "sm" ? 16 : 18} /> : null}
      <span>{children}</span>
    </button>
  );
}

export function Card({ children, className = "", ...props }) {
  return (
    <section className={`card ${className}`} {...props}>
      {children}
    </section>
  );
}

export function Badge({ children, tone = "neutral" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Progress({ value, label }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="progress-wrap" aria-label={label}>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${safeValue}%` }} />
      </div>
      {label ? <span>{label}</span> : null}
    </div>
  );
}

export function Empty({ title, description }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◇</div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-button" onClick={onClose} aria-label="닫기">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
