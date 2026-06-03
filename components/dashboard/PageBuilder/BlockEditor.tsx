"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

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
}: {
  blocks: unknown;
  onChange: (next: Block[]) => void;
}) {
  const list: Block[] = Array.isArray(blocks) ? (blocks as Block[]) : [];

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
          <Card key={b.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
