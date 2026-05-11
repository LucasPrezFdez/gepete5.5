"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ChatRole = "user" | "assistant";
type ChatMessage = { id: string; role: ChatRole; content: string };

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "¡Hola! Soy el asistente IA de GameIndex. Pregúntame lo que quieras sobre videojuegos: recomendaciones, sagas, lanzamientos, lore, comparativas..."
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open, loading]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed
    };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const payload = next
        .filter((m) => m.id !== "welcome")
        .map(({ role, content }) => ({ role, content }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo contactar con el asistente.");
      }

      const data = (await response.json()) as { reply?: string };
      if (!data.reply) throw new Error("Respuesta vacía del asistente.");

      setMessages((current) => [
        ...current,
        { id: `a-${Date.now()}`, role: "assistant", content: data.reply! }
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  function resetConversation() {
    setMessages([WELCOME]);
    setError(null);
  }

  return (
    <div className="fixed bottom-4 right-4 z-[55] flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      {open && (
        <div
          role="dialog"
          aria-label="Asistente IA de videojuegos"
          className="flex h-[34rem] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface/95 shadow-card backdrop-blur-xl"
        >
          <header className="flex items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-r from-electric/20 to-violet/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-electric to-violet text-xs font-black text-white shadow-glow">
                IA
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">GameIndex Assistant</p>
                <p className="text-[11px] text-muted">Preguntas sobre videojuegos</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={resetConversation}
                className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-white/10 hover:text-foreground"
                aria-label="Nueva conversación"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-muted transition hover:bg-white/10 hover:text-foreground"
                aria-label="Cerrar chat"
              >
                ✕
              </button>
            </div>
          </header>

          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
            aria-live="polite"
          >
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-electric [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-electric [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-electric" />
                </span>
                Pensando...
              </div>
            )}
            {error && (
              <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </p>
            )}
          </div>

          <form
            className="border-t border-white/10 bg-background/60 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Pregunta sobre cualquier juego..."
                rows={1}
                maxLength={2000}
                disabled={loading}
                className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-white/10 bg-background/80 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-electric px-3 text-sm font-semibold text-white shadow-glow transition hover:bg-blue-500 disabled:pointer-events-none disabled:opacity-50"
                aria-label="Enviar mensaje"
              >
                Enviar
              </button>
            </div>
            <p className="mt-2 text-[10px] text-muted">
              Powered by Groq. Pueden producirse imprecisiones.
            </p>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Cerrar asistente IA" : "Abrir asistente IA"}
        className={cn(
          "inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-electric to-violet text-xl text-white shadow-glow transition hover:-translate-y-0.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
      >
        {open ? "✕" : <ChatIcon />}
      </button>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] break-words rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-[1.55]",
          isUser
            ? "bg-electric text-white shadow-sm"
            : "border border-white/10 bg-white/[0.04] text-foreground"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <FormattedMarkdown text={message.content} />
        )}
      </div>
    </div>
  );
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "h"; level: 2 | 3; text: string };

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "p", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ kind: list.type, items: list.items });
      list = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{2,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "h", level: heading[1].length === 2 ? 2 : 3, text: heading[2] });
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }

    const ordered = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(ordered[2]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key++} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key++} className="rounded bg-white/10 px-1 py-0.5 text-[12px] font-mono">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(
        <em key={key++} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function FormattedMarkdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.kind === "p") {
          return (
            <p key={index} className="whitespace-pre-wrap">
              {renderInline(block.text)}
            </p>
          );
        }
        if (block.kind === "h") {
          const className =
            block.level === 2 ? "text-sm font-bold text-foreground" : "text-[13px] font-semibold text-foreground";
          return (
            <p key={index} className={className}>
              {renderInline(block.text)}
            </p>
          );
        }
        if (block.kind === "ul") {
          return (
            <ul key={index} className="space-y-1 pl-4">
              {block.items.map((item, i) => (
                <li key={i} className="relative list-none">
                  <span
                    aria-hidden="true"
                    className="absolute -left-3 top-[0.55em] inline-block h-1.5 w-1.5 rounded-full bg-electric/70"
                  />
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <ol key={index} className="list-decimal space-y-1 pl-5 marker:text-muted">
            {block.items.map((item, i) => (
              <li key={i}>{renderInline(item)}</li>
            ))}
          </ol>
        );
      })}
    </div>
  );
}

function ChatIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
