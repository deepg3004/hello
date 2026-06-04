"use client";

import type { ElementType } from "react";

/**
 * In-canvas editable text. Uncontrolled contentEditable that commits on blur
 * (so typing never triggers a re-render → no cursor jumps). Only rendered in
 * the editor preview; the public site renders plain text instead.
 */
export function EditableText({
  value,
  onCommit,
  as: Tag = "span",
  className,
  placeholder,
}: {
  value: string;
  onCommit: (next: string) => void;
  as?: ElementType;
  className?: string;
  placeholder?: string;
}) {
  return (
    <Tag
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      onBlur={(e: React.FocusEvent<HTMLElement>) =>
        onCommit(e.currentTarget.textContent ?? "")
      }
      className={className}
      style={{ outline: "none", cursor: "text" }}
      title="Click to edit"
    >
      {value}
    </Tag>
  );
}
