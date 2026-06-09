"use client";

// Phase-2 Elementor-style editor:
//  • drag widgets from the palette onto columns (@dnd-kit) + sortable reorder
//  • click to select; duplicate / delete
//  • Desktop / Tablet / Mobile toggle — canvas resizes AND style is edited
//    per-device (tablet/mobile inherit desktop, override what you set)
//  • Settings panel with CONTENT / STYLE / ADVANCED tabs
//  • Undo / Redo (history stack)
//  • Preview mode (renders via the shared BlockRenderer with animations)
//  • Save draft -> PUT /api/builder/pages/[id]
// Phase 3 adds the remaining widgets (form, gallery, Razorpay, etc.).

import { useEffect, useMemo, useState } from "react";
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
import {
  Copy,
  Eye,
  GripVertical,
  Loader2,
  Monitor,
  Pencil,
  Plus,
  Redo2,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { WIDGET_LIST, widgetDef, type FieldSpec } from "@/lib/builder/widget-registry";
import { ICON_NAMES } from "@/components/builder/widgets/BuilderIcon";
import { BlockRenderer } from "@/components/builder/BlockRenderer";
import {
  asDocument,
  uid,
  type BuilderDocument,
  type Device,
  type WidgetNode,
} from "@/lib/builder/types";
import {
  resolveStyle,
  toCss,
  ANIMATION_OPTIONS,
  type ResponsiveStyle,
  type StyleProps,
} from "@/lib/builder/style";

interface PageRow {
  id: string;
  name: string;
  content_json: unknown;
}

type Tab = "content" | "style" | "advanced";

const DEVICE_WIDTH: Record<Device, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "420px",
};

export function BuilderEditor({ mode = "page" }: { mode?: "page" | "header" | "footer" }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<PageRow | null>(null);
  const [siteId, setSiteId] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(false); // loaded a target doc to edit

  // History stack — `doc` is always history[hi].
  const [history, setHistory] = useState<BuilderDocument[]>([{ sections: [] }]);
  const [hi, setHi] = useState(0);
  const doc = useMemo<BuilderDocument>(() => history[hi] ?? { sections: [] }, [history, hi]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [tab, setTab] = useState<Tab>("content");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // ── Load / bootstrap ────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/builder/sites/me");
        const data = (await res.json()) as {
          pages?: PageRow[];
          site?: { id?: string; header_json?: unknown; footer_json?: unknown };
        };
        if (!alive) return;
        const first = data.pages?.[0] ?? null;
        setPage(first);
        setSiteId(data.site?.id);
        // Edit the page's content, or the site's GLOBAL header/footer document.
        const source =
          mode === "header"
            ? data.site?.header_json
            : mode === "footer"
              ? data.site?.footer_json
              : first?.content_json;
        setHistory([asDocument(source)]);
        setHi(0);
        // Header/footer don't need a page row to be editable.
        setReady(mode === "page" ? !!first : !!data.site?.id);
      } catch {
        /* leave empty */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode]);

  // ── History-aware commit + undo/redo ────────────────────────────────────────
  function commit(next: BuilderDocument) {
    setHistory((h) => {
      const trimmed = h.slice(0, hi + 1);
      trimmed.push(next);
      // Cap history so it can't grow unbounded.
      const capped = trimmed.slice(-100);
      setHi(capped.length - 1);
      return capped;
    });
  }
  const canUndo = hi > 0;
  const canRedo = hi < history.length - 1;
  const undo = () => canUndo && setHi(hi - 1);
  const redo = () => canRedo && setHi(hi + 1);

  // ── Tree mutations (all go through commit) ──────────────────────────────────
  function mutateColumn(colId: string, fn: (widgets: WidgetNode[]) => WidgetNode[]) {
    commit({
      sections: doc.sections.map((sec) => ({
        ...sec,
        columns: sec.columns.map((col) =>
          col.id === colId ? { ...col, widgets: fn(col.widgets) } : col,
        ),
      })),
    });
  }
  function mutateWidget(id: string, fn: (w: WidgetNode) => WidgetNode) {
    commit({
      sections: doc.sections.map((sec) => ({
        ...sec,
        columns: sec.columns.map((col) => ({
          ...col,
          widgets: col.widgets.map((w) => (w.id === id ? fn(w) : w)),
        })),
      })),
    });
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
    const w: WidgetNode = { id: uid("w"), type, content: { ...def.defaultContent }, style: {}, animation: "none" };
    mutateColumn(colId, (ws) => {
      const next = [...ws];
      next.splice(index ?? next.length, 0, w);
      return next;
    });
    setSelectedId(w.id);
    setTab("content");
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
      const src = ws[i]!;
      const copy: WidgetNode = { ...src, id: uid("w"), content: { ...src.content }, style: { ...(src.style ?? {}) } };
      const next = [...ws];
      next.splice(i + 1, 0, copy);
      return next;
    });
  }
  function updateContent(id: string, patch: Record<string, unknown>) {
    mutateWidget(id, (w) => ({ ...w, content: { ...w.content, ...patch } }));
  }
  function updateStyle(id: string, patch: Partial<StyleProps>) {
    mutateWidget(id, (w) => {
      const style = { ...(w.style as ResponsiveStyle | undefined) } as ResponsiveStyle;
      style[device] = { ...(style[device] ?? {}), ...patch };
      return { ...w, style };
    });
  }
  function updateAnimation(id: string, animation: string) {
    mutateWidget(id, (w) => ({ ...w, animation }));
  }
  function addSection() {
    commit({
      sections: [...doc.sections, { id: uid("sec"), columns: [{ id: uid("col"), width: 100, widgets: [] }] }],
    });
  }

  // ── DnD: palette→column adds; widget→widget reorders within a column ─────────
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId.startsWith("palette:")) {
      const type = activeId.slice("palette:".length);
      const colId = overId.startsWith("drop:") ? overId.slice("drop:".length) : columnIdOfWidget(overId);
      if (colId) {
        const col = doc.sections.flatMap((s) => s.columns).find((c) => c.id === colId);
        const idx = overId.startsWith("drop:")
          ? undefined
          : Math.max(0, col?.widgets.findIndex((w) => w.id === overId) ?? -1) || undefined;
        addWidget(colId, type, idx);
      }
      return;
    }
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
    setSaving(true);
    try {
      // Page content vs the GLOBAL header/footer document go to different endpoints.
      const req =
        mode === "header"
          ? { url: "/api/builder/sites/me/header", body: { header_json: doc } }
          : mode === "footer"
            ? { url: "/api/builder/sites/me/footer", body: { footer_json: doc } }
            : page
              ? { url: `/api/builder/pages/${page.id}`, body: { content_json: doc } }
              : null;
      if (!req) return;
      const res = await fetch(req.url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req.body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      toast({
        title: "Saved",
        description: mode === "page" ? "Your page draft is saved." : `Your ${mode} is saved (shows on every page).`,
      });
    } catch (err) {
      toast({ title: "Couldn't save", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const selected = useMemo(
    () =>
      selectedId
        ? doc.sections.flatMap((s) => s.columns).flatMap((c) => c.widgets).find((w) => w.id === selectedId) ?? null
        : null,
    [selectedId, doc],
  );

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading builder…
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        The builder is being set up. Please check back shortly.
      </div>
    );
  }

  const canvasInner = (
    <div className="mx-auto transition-all" style={{ maxWidth: DEVICE_WIDTH[device] }}>
      {preview ? (
        <BlockRenderer doc={doc} device={device} siteId={siteId} preview />
      ) : (
        doc.sections.map((sec) => (
          <div key={sec.id} className="mb-4 rounded-lg border border-dashed border-border/70 p-3">
            <div className={`flex gap-4 ${device === "mobile" ? "flex-col" : "flex-col md:flex-row"}`}>
              {sec.columns.map((col) => (
                <ColumnDropZone key={col.id} colId={col.id} empty={col.widgets.length === 0}>
                  <SortableContext items={col.widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                    {col.widgets.map((w) => {
                      const resolved = resolveStyle(w.style as ResponsiveStyle | undefined, device);
                      return (
                        <SortableWidget
                          key={w.id}
                          id={w.id}
                          selected={selectedId === w.id}
                          hidden={!!resolved.hidden}
                          device={device}
                          onSelect={() => setSelectedId(w.id)}
                          onDelete={() => removeWidget(w.id)}
                          onDuplicate={() => duplicateWidget(w.id)}
                        >
                          {/* pointer-events-none → clicking selects the widget
                              rather than interacting with its links/inputs. */}
                          <div style={toCss(resolved)} className="pointer-events-none">
                            {widgetDef(w.type)?.Render(w.content ?? {})}
                          </div>
                        </SortableWidget>
                      );
                    })}
                  </SortableContext>
                </ColumnDropZone>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
        {/* Device toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {(["desktop", "tablet", "mobile"] as Device[]).map((d) => {
            const Icon = d === "desktop" ? Monitor : d === "tablet" ? Tablet : Smartphone;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                className={`rounded-md p-1.5 transition ${device === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title={d}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} title="Undo">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} title="Redo">
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPreview((p) => !p)}>
            {preview ? <Pencil className="mr-1.5 h-4 w-4" /> : <Eye className="mr-1.5 h-4 w-4" />}
            {preview ? "Edit" : "Preview"}
          </Button>
          <Button variant="outline" size="sm" onClick={addSection}>
            <Plus className="mr-1.5 h-4 w-4" /> Section
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[170px_1fr_280px]">
        {/* Palette */}
        <aside className={`space-y-2 ${preview ? "pointer-events-none opacity-40" : ""}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Widgets</p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {WIDGET_LIST.map((def) => (
              <PaletteItem
                key={def.type}
                type={def.type}
                label={def.label}
                Icon={def.icon}
                onAdd={() => {
                  const firstCol = doc.sections[0]?.columns[0]?.id;
                  if (firstCol) addWidget(firstCol, def.type);
                }}
              />
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <main className="min-h-[60vh] rounded-xl border border-border bg-background p-4">{canvasInner}</main>

        {/* Settings */}
        <aside className="rounded-xl border border-border bg-card p-4">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select a widget to edit it.</p>
          ) : (
            <SettingsPanel
              widget={selected}
              device={device}
              tab={tab}
              setTab={setTab}
              onContent={(p) => updateContent(selected.id, p)}
              onStyle={(p) => updateStyle(selected.id, p)}
              onAnimation={(v) => updateAnimation(selected.id, v)}
            />
          )}
        </aside>
      </div>
    </DndContext>
  );
}

// ── Palette item ──────────────────────────────────────────────────────────────
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
      className={`flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition hover:border-primary ${isDragging ? "opacity-50" : ""}`}
      title={`Drag onto the canvas or click to add ${label}`}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </button>
  );
}

// ── Column drop zone ──────────────────────────────────────────────────────────
function ColumnDropZone({ colId, empty, children }: { colId: string; empty: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop:${colId}` });
  return (
    <div ref={setNodeRef} className={`flex flex-1 flex-col gap-2 rounded-lg p-2 transition ${isOver ? "bg-primary/5 ring-2 ring-primary/40" : ""}`}>
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

// ── Sortable widget wrapper ─────────────────────────────────────────────────────
function SortableWidget({
  id,
  selected,
  hidden,
  device,
  onSelect,
  onDelete,
  onDuplicate,
  children,
}: {
  id: string;
  selected: boolean;
  hidden: boolean;
  device: Device;
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
      className={`group relative rounded-lg border p-3 transition ${selected ? "border-primary ring-1 ring-primary" : "border-transparent hover:border-border"} ${hidden ? "opacity-40" : ""}`}
    >
      {hidden && (
        <span className="absolute left-2 top-1 z-10 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Hidden on {device}
        </span>
      )}
      <div className="absolute -top-3 right-2 z-10 hidden items-center gap-1 rounded-md border border-border bg-card px-1 py-0.5 shadow-sm group-hover:flex">
        <button type="button" {...listeners} {...attributes} className="cursor-grab p-1 text-muted-foreground hover:text-foreground" title="Drag to reorder" onClick={(e) => e.stopPropagation()}>
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="p-1 text-muted-foreground hover:text-foreground" title="Duplicate">
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-destructive hover:opacity-80" title="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}

// ── Settings panel (Content / Style / Advanced) ────────────────────────────────
function SettingsPanel({
  widget,
  device,
  tab,
  setTab,
  onContent,
  onStyle,
  onAnimation,
}: {
  widget: WidgetNode;
  device: Device;
  tab: Tab;
  setTab: (t: Tab) => void;
  onContent: (patch: Record<string, unknown>) => void;
  onStyle: (patch: Partial<StyleProps>) => void;
  onAnimation: (v: string) => void;
}) {
  const c = widget.content as Record<string, unknown>;
  const dStyle = ((widget.style as ResponsiveStyle | undefined)?.[device] ?? {}) as StyleProps;
  const num = (v: unknown) => (typeof v === "number" ? v : undefined);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-medium capitalize">{widget.type}</p>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">{device}</span>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border border-border p-0.5 text-xs">
        {(["content", "style", "advanced"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-2 py-1 capitalize transition ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* CONTENT — rendered generically from the widget's field schema. */}
      {tab === "content" && (
        <div className="space-y-3">
          {(widgetDef(widget.type)?.fields ?? []).map((f) => (
            <ContentField key={f.key} field={f} value={c[f.key]} onChange={(v) => onContent({ [f.key]: v })} />
          ))}
          {(widgetDef(widget.type)?.fields ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No content options for this widget.</p>
          )}
        </div>
      )}

      {/* STYLE (per device) */}
      {tab === "style" && (
        <div className="space-y-3">
          <Field label="Text color"><input type="color" value={dStyle.color || "#000000"} onChange={(e) => onStyle({ color: e.target.value })} className="h-9 w-full rounded-md border border-input" /></Field>
          <Field label="Background"><input value={dStyle.background ?? ""} onChange={(e) => onStyle({ background: e.target.value })} placeholder="e.g. #f5f5f5 or linear-gradient(...)" className={inputCls} /></Field>
          <Field label="Font size (px)"><input type="number" value={num(dStyle.fontSize) ?? ""} onChange={(e) => onStyle({ fontSize: e.target.value === "" ? undefined : Number(e.target.value) })} className={inputCls} /></Field>
          <Field label="Font weight">
            <Select value={dStyle.fontWeight ?? ""} onChange={(v) => onStyle({ fontWeight: v || undefined })} options={[["", "Default"], ["400", "Normal"], ["600", "Semibold"], ["700", "Bold"], ["800", "Extra bold"]]} />
          </Field>
        </div>
      )}

      {/* ADVANCED (per device) */}
      {tab === "advanced" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Padding Y"><input type="number" value={num(dStyle.paddingY) ?? ""} onChange={(e) => onStyle({ paddingY: e.target.value === "" ? undefined : Number(e.target.value) })} className={inputCls} /></Field>
            <Field label="Padding X"><input type="number" value={num(dStyle.paddingX) ?? ""} onChange={(e) => onStyle({ paddingX: e.target.value === "" ? undefined : Number(e.target.value) })} className={inputCls} /></Field>
            <Field label="Margin Y"><input type="number" value={num(dStyle.marginY) ?? ""} onChange={(e) => onStyle({ marginY: e.target.value === "" ? undefined : Number(e.target.value) })} className={inputCls} /></Field>
            <Field label="Margin X"><input type="number" value={num(dStyle.marginX) ?? ""} onChange={(e) => onStyle({ marginX: e.target.value === "" ? undefined : Number(e.target.value) })} className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Border width"><input type="number" value={num(dStyle.borderWidth) ?? ""} onChange={(e) => onStyle({ borderWidth: e.target.value === "" ? undefined : Number(e.target.value) })} className={inputCls} /></Field>
            <Field label="Border color"><input type="color" value={dStyle.borderColor || "#e5e7eb"} onChange={(e) => onStyle({ borderColor: e.target.value })} className="h-9 w-full rounded-md border border-input" /></Field>
          </div>
          <Field label="Corner radius"><input type="number" value={num(dStyle.borderRadius) ?? ""} onChange={(e) => onStyle({ borderRadius: e.target.value === "" ? undefined : Number(e.target.value) })} className={inputCls} /></Field>
          <Field label="Shadow">
            <Select value={dStyle.shadow ?? "none"} onChange={(v) => onStyle({ shadow: v as StyleProps["shadow"] })} options={[["none", "None"], ["sm", "Small"], ["md", "Medium"], ["lg", "Large"], ["xl", "Extra large"]]} />
          </Field>
          <Field label="Entrance animation">
            <Select value={widget.animation ?? "none"} onChange={onAnimation} options={ANIMATION_OPTIONS.map((a) => [a, a])} />
          </Field>
          <label className="flex items-center gap-2 pt-1">
            <input type="checkbox" checked={!!dStyle.hidden} onChange={(e) => onStyle({ hidden: e.target.checked })} />
            <span className="text-xs text-muted-foreground">Hide on {device}</span>
          </label>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

// Generic content field driven by the widget's field schema.
function ContentField({
  field,
  value,
  onChange,
}: {
  field: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.type === "list") {
    return <ListField field={field} value={value} onChange={onChange} />;
  }
  const sv = typeof value === "string" ? value : "";
  const nv = typeof value === "number" ? value : "";
  return (
    <Field label={field.label}>
      {field.type === "textarea" ? (
        <textarea value={sv} onChange={(e) => onChange(e.target.value)} rows={3} className={inputCls} />
      ) : field.type === "number" ? (
        <input
          type="number"
          value={nv}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          className={inputCls}
        />
      ) : field.type === "color" ? (
        <input type="color" value={sv || "#000000"} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border border-input" />
      ) : field.type === "select" ? (
        <Select value={sv} onChange={onChange} options={field.options} />
      ) : field.type === "icon" ? (
        <Select value={sv} onChange={onChange} options={ICON_NAMES.map((n) => [n, n] as [string, string])} />
      ) : (
        <input value={sv} onChange={(e) => onChange(e.target.value)} placeholder={field.type === "url" ? "https://…" : undefined} className={inputCls} />
      )}
    </Field>
  );
}

// Repeater for `list` fields (e.g. social links).
function ListField({
  field,
  value,
  onChange,
}: {
  field: Extract<FieldSpec, { type: "list" }>;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const items = (Array.isArray(value) ? value : []) as Record<string, unknown>[];
  const setItems = (next: Record<string, unknown>[]) => onChange(next);
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{field.label}</p>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="rounded-md border border-border p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] capitalize text-muted-foreground">{field.itemLabel} {i + 1}</span>
              <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-rose-500 hover:opacity-80">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            {field.itemFields.map((sub) => (
              <ContentField
                key={sub.key}
                field={sub}
                value={it[sub.key]}
                onChange={(v) => setItems(items.map((x, j) => (j === i ? { ...x, [sub.key]: v } : x)))}
              />
            ))}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setItems([...items, Object.fromEntries(field.itemFields.map((f) => [f.key, ""]))])}
        className="mt-2 text-xs font-medium text-primary hover:opacity-80"
      >
        + Add {field.itemLabel}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}
