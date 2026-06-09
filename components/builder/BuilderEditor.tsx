"use client";

// Phase-1 Elementor-style editor: a left widget palette, a center drag-drop
// canvas (PAGE -> SECTIONS -> COLUMNS -> WIDGETS) powered by @dnd-kit, and a
// minimal right panel to edit the selected widget's text. Drag a widget from the
// palette onto a column to add it; drag widgets to reorder; click to select;
// duplicate / delete; Save persists content_json. (Full Style/Advanced tabs,
// responsive toggle and Undo/Redo land in Phase 2.)

import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Loader2, Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { WIDGET_LIST, widgetDef } from "@/lib/builder/widget-registry";
import {
  asDocument,
  uid,
  type BuilderDocument,
  type WidgetNode,
} from "@/lib/builder/types";

interface PageRow {
  id: string;
  name: string;
  content_json: unknown;
}

export function BuilderEditor() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<PageRow | null>(null);
  const [doc, setDoc] = useState<BuilderDocument>({ sections: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // ── Load (or bootstrap) the seller's site + first page ──────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/builder/sites/me");
        const data = (await res.json()) as { pages?: PageRow[] };
        if (!alive) return;
        const first = data.pages?.[0] ?? null;
        setPage(first);
        setDoc(asDocument(first?.content_json));
      } catch {
        /* leave empty */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ── Tree helpers (immutable) ────────────────────────────────────────────────
  function mutateColumn(colId: string, fn: (widgets: WidgetNode[]) => WidgetNode[]) {
    setDoc((d) => ({
      sections: d.sections.map((sec) => ({
        ...sec,
        columns: sec.columns.map((col) =>
          col.id === colId ? { ...col, widgets: fn(col.widgets) } : col,
        ),
      })),
    }));
  }

  function columnIdOfWidget(widgetId: string): string | null {
    for (const sec of doc.sections)
      for (const col of sec.columns)
        if (col.widgets.some((w) => w.id === widgetId)) return col.id;
    return null;
  }

  function addWidget(colId: string, type: string, index?: number) {
    const def = widgetDef(type);
    if (!def) return;
    const w: WidgetNode = { id: uid("w"), type, content: { ...def.defaultContent } };
    mutateColumn(colId, (ws) => {
      const next = [...ws];
      next.splice(index ?? next.length, 0, w);
      return next;
    });
    setSelectedId(w.id);
  }

  function removeWidget(id: string) {
    const colId = columnIdOfWidget(id);
    if (colId) mutateColumn(colId, (ws) => ws.filter((w) => w.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function duplicateWidget(id: string) {
    const colId = columnIdOfWidget(id);
    if (!colId) return;
    mutateColumn(colId, (ws) => {
      const i = ws.findIndex((w) => w.id === id);
      if (i < 0) return ws;
      const copy: WidgetNode = { ...ws[i]!, id: uid("w"), content: { ...ws[i]!.content } };
      const next = [...ws];
      next.splice(i + 1, 0, copy);
      return next;
    });
  }

  function updateWidgetContent(id: string, patch: Record<string, unknown>) {
    const colId = columnIdOfWidget(id);
    if (!colId) return;
    mutateColumn(colId, (ws) =>
      ws.map((w) => (w.id === id ? { ...w, content: { ...w.content, ...patch } } : w)),
    );
  }

  function addSection() {
    setDoc((d) => ({
      sections: [...d.sections, { id: uid("sec"), columns: [{ id: uid("col"), width: 100, widgets: [] }] }],
    }));
  }

  // ── Drag end: palette→column adds; widget→widget reorders within a column ────
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // Adding from the palette.
    if (activeId.startsWith("palette:")) {
      const type = activeId.slice("palette:".length);
      const colId = overId.startsWith("drop:")
        ? overId.slice("drop:".length)
        : columnIdOfWidget(overId);
      if (colId) {
        const idx = overId.startsWith("drop:")
          ? undefined
          : (() => {
              const col = doc.sections.flatMap((s) => s.columns).find((c) => c.id === colId);
              const i = col?.widgets.findIndex((w) => w.id === overId) ?? -1;
              return i >= 0 ? i : undefined;
            })();
        addWidget(colId, type, idx);
      }
      return;
    }

    // Reordering an existing widget within its column.
    if (activeId === overId) return;
    const colId = columnIdOfWidget(activeId);
    if (!colId || columnIdOfWidget(overId) !== colId) return;
    mutateColumn(colId, (ws) => {
      const from = ws.findIndex((w) => w.id === activeId);
      const to = ws.findIndex((w) => w.id === overId);
      if (from < 0 || to < 0) return ws;
      return arrayMove(ws, from, to);
    });
  }

  async function save() {
    if (!page) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/builder/pages/${page.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content_json: doc }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      toast({ title: "Saved", description: "Your page draft is saved." });
    } catch (err) {
      toast({ title: "Couldn't save", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading builder…
      </div>
    );
  }

  if (!page) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        The builder is being set up. Please check back shortly.
      </div>
    );
  }

  const selected = selectedId
    ? doc.sections.flatMap((s) => s.columns).flatMap((c) => c.widgets).find((w) => w.id === selectedId)
    : null;

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      {/* Top bar */}
      <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{page?.name ?? "Page"}</p>
          <p className="text-xs text-muted-foreground">Drag a widget onto the canvas, then click it to edit.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addSection}>
            <Plus className="mr-1.5 h-4 w-4" /> Section
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !page}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Save draft
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[180px_1fr_260px]">
        {/* Widget palette */}
        <aside className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Widgets</p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {WIDGET_LIST.map((def) => (
              <PaletteItem key={def.type} type={def.type} label={def.label} Icon={def.icon} onAdd={() => {
                // Click-to-add: append to the first column (handy on mobile / no-drag).
                const firstCol = doc.sections[0]?.columns[0]?.id;
                if (firstCol) addWidget(firstCol, def.type);
              }} />
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <main className="min-h-[60vh] rounded-xl border border-border bg-background p-4">
          {doc.sections.map((sec) => (
            <div key={sec.id} className="mb-4 rounded-lg border border-dashed border-border/70 p-3">
              <div className="flex flex-col gap-4 md:flex-row">
                {sec.columns.map((col) => (
                  <ColumnDropZone key={col.id} colId={col.id} empty={col.widgets.length === 0}>
                    <SortableContext items={col.widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                      {col.widgets.map((w) => (
                        <SortableWidget
                          key={w.id}
                          id={w.id}
                          selected={selectedId === w.id}
                          onSelect={() => setSelectedId(w.id)}
                          onDelete={() => removeWidget(w.id)}
                          onDuplicate={() => duplicateWidget(w.id)}
                        >
                          {widgetDef(w.type)?.Render(w.content ?? {}, w.style)}
                        </SortableWidget>
                      ))}
                    </SortableContext>
                  </ColumnDropZone>
                ))}
              </div>
            </div>
          ))}
        </main>

        {/* Minimal settings panel (Phase 2 expands this into Content/Style/Advanced) */}
        <aside className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Settings</p>
          {!selected ? (
            <p className="mt-3 text-sm text-muted-foreground">Select a widget to edit it.</p>
          ) : (
            <WidgetQuickEdit widget={selected} onChange={(patch) => updateWidgetContent(selected.id, patch)} />
          )}
        </aside>
      </div>
    </DndContext>
  );
}

// ── Palette item: draggable + click-to-add ────────────────────────────────────
function PaletteItem({
  type,
  label,
  Icon,
  onAdd,
}: {
  type: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${type}` });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={onAdd}
      className={`flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition hover:border-primary ${
        isDragging ? "opacity-50" : ""
      }`}
      title={`Drag onto the canvas or click to add ${label}`}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </button>
  );
}

// ── Column drop zone ──────────────────────────────────────────────────────────
function ColumnDropZone({
  colId,
  empty,
  children,
}: {
  colId: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop:${colId}` });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-1 flex-col gap-2 rounded-lg p-2 transition ${
        isOver ? "bg-primary/5 ring-2 ring-primary/40" : ""
      }`}
    >
      {empty ? (
        <div className="flex min-h-[80px] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
          Drop a widget here
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// ── Sortable widget wrapper (select / drag-handle / duplicate / delete) ────────
function SortableWidget({
  id,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
  children,
}: {
  id: string;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`group relative rounded-lg border bg-background p-3 transition ${
        selected ? "border-primary ring-1 ring-primary" : "border-transparent hover:border-border"
      }`}
    >
      {/* Hover toolbar */}
      <div className="absolute -top-3 right-2 z-10 hidden items-center gap-1 rounded-md border border-border bg-card px-1 py-0.5 shadow-sm group-hover:flex">
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="cursor-grab p-1 text-muted-foreground hover:text-foreground"
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="p-1 text-muted-foreground hover:text-foreground"
          title="Duplicate"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 text-destructive hover:opacity-80"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}

// ── Minimal per-widget editor (Phase 2 replaces with full Content/Style tabs) ──
function WidgetQuickEdit({
  widget,
  onChange,
}: {
  widget: WidgetNode;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const c = widget.content as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return (
    <div className="mt-3 space-y-3 text-sm">
      <p className="font-medium capitalize">{widget.type}</p>

      {(widget.type === "heading" || widget.type === "text" || widget.type === "button") && (
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            {widget.type === "button" ? "Button label" : "Text"}
          </span>
          <textarea
            value={widget.type === "button" ? str(c.label) : str(c.text)}
            onChange={(e) => onChange(widget.type === "button" ? { label: e.target.value } : { text: e.target.value })}
            rows={widget.type === "text" ? 4 : 2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      )}

      {widget.type === "button" && (
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Link URL</span>
          <input
            value={str(c.url)}
            onChange={(e) => onChange({ url: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      )}

      {widget.type === "image" && (
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Image URL</span>
          <input
            value={str(c.src)}
            onChange={(e) => onChange({ src: e.target.value })}
            placeholder="https://…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      )}

      {(widget.type === "heading" || widget.type === "text" || widget.type === "image" || widget.type === "button") && (
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Alignment</span>
          <select
            value={str(c.align) || "left"}
            onChange={(e) => onChange({ align: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>
      )}
    </div>
  );
}
