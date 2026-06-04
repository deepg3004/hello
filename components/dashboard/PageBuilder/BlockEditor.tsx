"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldEditor } from "./FieldEditor";
import { BLOCKS, BLOCK_LIST } from "@/components/templates/blocks/registry";

interface Block {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export function BlockEditor({
  blocks,
  onChange,
  selectedId,
  onSelect,
}: {
  blocks: unknown;
  onChange: (next: Block[]) => void;
  /** Selected block id (click-to-edit from the preview). */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const list: Block[] = Array.isArray(blocks) ? (blocks as Block[]) : [];
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (selectedId && cardRefs.current[selectedId]) {
      cardRefs.current[selectedId]!.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedId]);

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    onChange(next);
  }

  function add(type: string) {
    const def = BLOCKS[type];
    if (!def) return;
    const id = `blk_${Math.random().toString(36).slice(2, 8)}`;
    onChange([...list, { id, type, data: { ...def.defaultData } }]);
  }
  const update = (i: number, data: Record<string, unknown>) =>
    onChange(list.map((b, idx) => (idx === i ? { ...b, data } : b)));
  const remove = (i: number) => onChange(list.filter((_, idx) => idx !== i));
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Page blocks</CardTitle>
          <CardDescription>
            Add, reorder and edit the sections of your page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {BLOCK_LIST.map((def) => (
              <Button
                key={def.type}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => add(def.type)}
              >
                <Plus className="mr-1 h-3 w-3" /> {def.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {list.length === 0 && (
        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
          No blocks yet. Add one above to start building your page.
        </p>
      )}

      {list.map((b, i) => {
        const def = BLOCKS[b.type];
        if (!def) return null;
        return (
          <Card
            key={b.id}
            ref={(el) => {
              cardRefs.current[b.id] = el;
            }}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              setOverIndex(i);
            }}
            onDrop={() => {
              if (dragIndex !== null) reorder(dragIndex, i);
              setDragIndex(null);
              setOverIndex(null);
            }}
            className={
              overIndex === i && dragIndex !== null && dragIndex !== i
                ? "ring-2 ring-primary"
                : dragIndex === i
                  ? "opacity-50"
                  : selectedId === b.id
                    ? "ring-2 ring-indigo-500"
                    : undefined
            }
          >
            <CardHeader className="pb-3" onClick={() => onSelect?.(b.id)}>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <span
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setOverIndex(null);
                    }}
                    aria-label="Drag to reorder"
                    title="Drag to reorder"
                    className="cursor-grab text-muted-foreground active:cursor-grabbing"
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>
                  {i + 1}. {def.label}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === list.length - 1}
                    aria-label="Move down"
                    className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label="Remove block"
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {def.fields.map((f) => (
                <FieldEditor
                  key={f.key}
                  field={f}
                  value={(b.data ?? {})[f.key]}
                  onChange={(v) =>
                    update(i, { ...(b.data ?? {}), [f.key]: v })
                  }
                />
              ))}
              <div className="space-y-1.5 border-t pt-3">
                <label className="text-xs font-medium text-muted-foreground">
                  Section background
                </label>
                <select
                  value={String((b.data ?? {})._bg ?? "default")}
                  onChange={(e) =>
                    update(i, { ...(b.data ?? {}), _bg: e.target.value })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="default">Default</option>
                  <option value="subtle">Subtle</option>
                  <option value="accent">Accent tint</option>
                </select>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
