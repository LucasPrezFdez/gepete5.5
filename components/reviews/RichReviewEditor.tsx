"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onTextLength?: (length: number) => void;
  placeholder?: string;
};

export function RichReviewEditor({ value, onChange, onTextLength, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
        codeBlock: false,
        horizontalRule: false
      })
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose-review block min-h-[320px] w-full px-5 py-4 text-base leading-7 text-foreground focus:outline-none",
        "aria-label": "Editor de reseña"
      },
      handleKeyDown: (view, event) => {
        if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false;
        const { $from } = view.state.selection;
        for (let depth = $from.depth; depth >= 0; depth--) {
          const node = $from.node(depth);
          if (node.type.name === "listItem" || node.type.name === "blockquote") return false;
        }
        const hardBreak = view.state.schema.nodes.hardBreak;
        if (!hardBreak) return false;
        const tr = view.state.tr.replaceSelectionWith(hardBreak.create(), true).scrollIntoView();
        view.dispatch(tr);
        return true;
      }
    },
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML();
      onChange(instance.isEmpty ? "" : html);
      onTextLength?.(instance.getText().length);
    }
  });

  useEffect(() => {
    if (!editor) return;
    onTextLength?.(editor.getText().length);
  }, [editor, onTextLength]);

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const handler = () => forceUpdate((tick) => tick + 1);
    editor.on("selectionUpdate", handler);
    editor.on("transaction", handler);
    return () => {
      editor.off("selectionUpdate", handler);
      editor.off("transaction", handler);
    };
  }, [editor]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-background/70 transition focus-within:border-electric focus-within:ring-1 focus-within:ring-electric/40">
      <Toolbar editor={editor} />
      <div className="relative">
        {editor && editor.isEmpty && placeholder && (
          <div className="pointer-events-none absolute left-5 top-4 select-none text-base leading-7 text-muted/80">
            {placeholder}
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

type ToolbarAction = {
  key: string;
  label: string;
  title: string;
  icon: IconName;
  isActive?: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

const ACTIONS: ToolbarAction[] = [
  {
    key: "bold",
    label: "Negrita",
    title: "Negrita (Ctrl+B)",
    icon: "bold",
    isActive: (editor) => editor.isActive("bold"),
    run: (editor) => editor.chain().focus().toggleBold().run()
  },
  {
    key: "italic",
    label: "Cursiva",
    title: "Cursiva (Ctrl+I)",
    icon: "italic",
    isActive: (editor) => editor.isActive("italic"),
    run: (editor) => editor.chain().focus().toggleItalic().run()
  },
  {
    key: "strike",
    label: "Tachado",
    title: "Tachado",
    icon: "strike",
    isActive: (editor) => editor.isActive("strike"),
    run: (editor) => editor.chain().focus().toggleStrike().run()
  },
  {
    key: "heading",
    label: "Subtítulo",
    title: "Subtítulo",
    icon: "heading",
    isActive: (editor) => editor.isActive("heading", { level: 3 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run()
  },
  {
    key: "bulletList",
    label: "Lista",
    title: "Lista con viñetas",
    icon: "list",
    isActive: (editor) => editor.isActive("bulletList"),
    run: (editor) => editor.chain().focus().toggleBulletList().run()
  },
  {
    key: "orderedList",
    label: "Lista numerada",
    title: "Lista numerada",
    icon: "orderedList",
    isActive: (editor) => editor.isActive("orderedList"),
    run: (editor) => editor.chain().focus().toggleOrderedList().run()
  },
  {
    key: "blockquote",
    label: "Cita",
    title: "Cita",
    icon: "quote",
    isActive: (editor) => editor.isActive("blockquote"),
    run: (editor) => editor.chain().focus().toggleBlockquote().run()
  },
  {
    key: "code",
    label: "Código",
    title: "Código en línea",
    icon: "code",
    isActive: (editor) => editor.isActive("code"),
    run: (editor) => editor.chain().focus().toggleCode().run()
  }
];

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) {
    return <div className="h-11 border-b border-white/10 bg-white/[0.03]" aria-hidden />;
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-white/10 bg-white/[0.03] px-2 py-1.5">
      {ACTIONS.map((action, index) => {
        const active = action.isActive?.(editor) ?? false;
        return (
          <span key={action.key} className="flex items-center">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => action.run(editor)}
              title={action.title}
              aria-label={action.label}
              aria-pressed={active}
              className={`relative grid h-8 w-8 place-items-center rounded-lg border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-electric ${
                active
                  ? "border-electric/70 bg-electric text-white shadow-[0_0_0_1px_rgba(59,130,246,0.45),0_0_18px_rgba(59,130,246,0.45)]"
                  : "border-transparent text-muted hover:bg-white/10 hover:text-foreground"
              }`}
            >
              <ToolbarIcon name={action.icon} />
            </button>
            {(index === 2 || index === 5) && <span className="mx-1 h-5 w-px bg-white/10" aria-hidden />}
          </span>
        );
      })}
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Deshacer (Ctrl+Z)"
          aria-label="Deshacer"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-white/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ToolbarIcon name="undo" />
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Rehacer (Ctrl+Shift+Z)"
          aria-label="Rehacer"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-white/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ToolbarIcon name="redo" />
        </button>
      </div>
    </div>
  );
}

type IconName = "bold" | "italic" | "strike" | "heading" | "list" | "orderedList" | "quote" | "code" | "undo" | "redo";

function ToolbarIcon({ name }: { name: IconName }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };
  switch (name) {
    case "bold":
      return (
        <svg {...common}>
          <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" />
          <path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z" />
        </svg>
      );
    case "italic":
      return (
        <svg {...common}>
          <line x1="19" y1="4" x2="10" y2="4" />
          <line x1="14" y1="20" x2="5" y2="20" />
          <line x1="15" y1="4" x2="9" y2="20" />
        </svg>
      );
    case "strike":
      return (
        <svg {...common}>
          <path d="M4 12h16" />
          <path d="M16 6.5C15 5 13 4.5 11 4.5c-3 0-5 1.5-5 3.5 0 1.5 1 2.5 3 3" />
          <path d="M8 17.5c1 1.5 3 2 5 2 3 0 5-1.5 5-3.5 0-1.5-1-2.5-3-3" />
        </svg>
      );
    case "heading":
      return (
        <svg {...common}>
          <path d="M6 4v16" />
          <path d="M14 4v16" />
          <path d="M6 12h8" />
          <path d="M18 13l2-1v8" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <line x1="9" y1="6" x2="20" y2="6" />
          <line x1="9" y1="12" x2="20" y2="12" />
          <line x1="9" y1="18" x2="20" y2="18" />
          <circle cx="4.5" cy="6" r="1.2" />
          <circle cx="4.5" cy="12" r="1.2" />
          <circle cx="4.5" cy="18" r="1.2" />
        </svg>
      );
    case "orderedList":
      return (
        <svg {...common}>
          <line x1="10" y1="6" x2="20" y2="6" />
          <line x1="10" y1="12" x2="20" y2="12" />
          <line x1="10" y1="18" x2="20" y2="18" />
          <path d="M4 6h2v0M4 4.5L5.5 4v4" />
          <path d="M4 14a1.5 1.5 0 1 1 3 0c0 1.5-3 2-3 4h3" />
          <path d="M4 18.5a1.5 1.5 0 0 0 3 0 1.2 1.2 0 0 0-1.2-1.2 1.2 1.2 0 0 0 1.2-1.2 1.5 1.5 0 0 0-3 0" />
        </svg>
      );
    case "quote":
      return (
        <svg {...common}>
          <path d="M7 7h4v4H7a2 2 0 0 0-2 2v2" />
          <path d="M15 7h4v4h-4a2 2 0 0 0-2 2v2" />
        </svg>
      );
    case "code":
      return (
        <svg {...common}>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    case "undo":
      return (
        <svg {...common}>
          <polyline points="3 7 3 13 9 13" />
          <path d="M3.5 13a8 8 0 1 0 2.5-7L3 9" />
        </svg>
      );
    case "redo":
      return (
        <svg {...common}>
          <polyline points="21 7 21 13 15 13" />
          <path d="M20.5 13a8 8 0 1 1-2.5-7L21 9" />
        </svg>
      );
  }
}
