"use client";

import Link from "next/link";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { createBrowserAuthClient } from "@/services/auth-browser";

type ChatRole = "user" | "assistant";
type ChatMessage = { id: string; role: ChatRole; content: string };

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "¡Hola! Soy el asistente IA de **GameIndex**. Pregúntame lo que quieras sobre videojuegos: recomendaciones, sagas, lanzamientos, lore, comparativas..."
};

const STORAGE_KEY = "gameindex.chat.history.v1";
const MAX_PERSISTED_MESSAGES = 30;

const SUGGESTIONS = [
  "¿Qué juegos salen esta semana?",
  "Top 5 RPG de 2025",
  "Recomiéndame algo como Hollow Knight",
  "¿Qué novedades hay en PC?"
];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load persisted conversation on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ChatMessage[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMessages([WELCOME, ...parsed.filter((m) => m.id !== "welcome")]);
      }
    } catch {
      // ignore corrupted storage
    }
  }, []);

  // Persist conversation (excluding the welcome message)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const toStore = messages.filter((m) => m.id !== "welcome").slice(-MAX_PERSISTED_MESSAGES);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // quota or privacy mode — ignore
    }
  }, [messages]);

  // Subscribe to auth session to forward token for personalized answers
  useEffect(() => {
    let mounted = true;
    let client: ReturnType<typeof createBrowserAuthClient>;
    try {
      client = createBrowserAuthClient();
    } catch {
      return () => {
        mounted = false;
      };
    }
    client.auth.getSession().then(({ data }) => {
      if (mounted) setAuthToken(data.session?.access_token ?? null);
    });
    const { data } = client.auth.onAuthStateChange((_evt, session) => {
      if (mounted) setAuthToken(session?.access_token ?? null);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Cancel any in-flight stream on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (overrideText?: string) => {
      const trimmed = (overrideText ?? input).trim();
      if (!trimmed || loading) return;

      // Cancel previous request if any
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed
      };
      const assistantId = `a-${Date.now() + 1}`;
      const next = [...messages, userMessage, { id: assistantId, role: "assistant" as const, content: "" }];
      setMessages(next);
      setInput("");
      setLoading(true);
      setError(null);
      setStatusHint("Pensando…");

      try {
        const payload = next
          .filter((m) => m.id !== "welcome" && m.id !== assistantId)
          .map(({ role, content }) => ({ role, content }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify({ messages: payload }),
          signal: controller.signal
        });

        if (!response.ok || !response.body) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error ?? "No se pudo contactar con el asistente.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = buffer.indexOf("\n\n")) !== -1) {
            const block = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 2);
            for (const rawLine of block.split("\n")) {
              if (!rawLine.startsWith("data:")) continue;
              const data = rawLine.slice(5).trim();
              if (!data) continue;
              let event: { type: string; text?: string; message?: string; name?: string };
              try {
                event = JSON.parse(data);
              } catch {
                continue;
              }
              if (event.type === "delta" && typeof event.text === "string") {
                const chunk = event.text;
                setStatusHint(null);
                setMessages((current) =>
                  current.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))
                );
              } else if (event.type === "tool") {
                const toolLabel =
                  event.name === "search_games"
                    ? "Buscando en el catálogo…"
                    : event.name === "get_game_details"
                      ? "Consultando ficha del juego…"
                      : event.name === "get_similar_games"
                        ? "Buscando juegos similares…"
                        : "Consultando datos…";
                setStatusHint(toolLabel);
              } else if (event.type === "open") {
                setStatusHint("Pensando…");
              } else if (event.type === "error") {
                throw new Error(event.message || "Error en el asistente.");
              } else if (event.type === "done") {
                // stream finished naturally
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // user cancelled — keep partial content but no error banner
        } else {
          const message = err instanceof Error ? err.message : "Error inesperado.";
          setError(message);
          // Drop the placeholder assistant message if it stayed empty
          setMessages((current) =>
            current.filter((m) => !(m.id === assistantId && m.content === ""))
          );
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setLoading(false);
        setStatusHint(null);
      }
    },
    [authToken, input, loading, messages]
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function resetConversation() {
    abortRef.current?.abort();
    setMessages([WELCOME]);
    setError(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  const showSuggestions = useMemo(
    () => !loading && messages.filter((m) => m.role === "user").length === 0,
    [loading, messages]
  );

  return (
    <div className="fixed bottom-4 right-4 z-[55] flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      <div
        role="dialog"
        aria-label="Asistente IA de videojuegos"
        aria-hidden={!open}
        inert={!open || undefined}
        className={cn(
          "flex h-[34rem] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface/95 shadow-card backdrop-blur-xl",
          "origin-bottom-right transform-gpu transition-all duration-200 ease-out",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-3 scale-95 opacity-0"
        )}
      >
          <header className="flex items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-r from-electric/20 to-violet/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-electric to-violet text-xs font-black text-white shadow-glow">
                IA
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">GameIndex Assistant</p>
                <p className="text-xs text-muted">Preguntas sobre videojuegos</p>
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

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
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
                {statusHint ?? "Escribiendo…"}
                <button
                  type="button"
                  onClick={stop}
                  className="ml-auto rounded-md border border-white/10 px-2 py-0.5 text-xs text-muted transition hover:bg-white/10 hover:text-foreground"
                >
                  Detener
                </button>
              </div>
            )}
            {error && (
              <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </p>
            )}
            {showSuggestions && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted transition hover:border-electric/50 hover:bg-electric/10 hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
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
              <AutoTextarea
                ref={inputRef}
                value={input}
                onChange={setInput}
                onKeyDown={onKeyDown}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-electric px-3 text-sm font-semibold text-white shadow-glow transition hover:bg-electric/85 disabled:pointer-events-none disabled:opacity-50"
                aria-label="Enviar mensaje"
              >
                Enviar
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">
              Powered by Groq. Pueden producirse imprecisiones.
            </p>
          </form>
        </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Cerrar asistente IA" : "Abrir asistente IA"}
        className={cn(
          "relative inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-electric to-violet text-xl text-white shadow-glow",
          "transition-transform duration-300 ease-out hover:-translate-y-0.5 hover:scale-105 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 grid place-items-center transition-all duration-300 ease-out",
            open ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
          )}
        >
          <ChatIcon />
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 grid place-items-center text-lg transition-all duration-300 ease-out",
            open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
          )}
        >
          ✕
        </span>
      </button>
    </div>
  );
}

type AutoTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
};

const AutoTextarea = forwardRef<HTMLTextAreaElement, AutoTextareaProps>(
  function AutoTextarea(props, ref) {
    const internalRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement, []);

    useEffect(() => {
      const node = internalRef.current;
      if (!node) return;
      node.style.height = "auto";
      node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
    }, [props.value]);

    return (
      <textarea
        ref={internalRef}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        onKeyDown={props.onKeyDown}
        placeholder="Pregunta sobre cualquier juego..."
        rows={1}
        maxLength={2000}
        disabled={props.disabled}
        className="max-h-40 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-white/10 bg-background/80 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric disabled:opacity-60"
      />
    );
  }
);

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }, [message.content]);

  return (
    <div className={cn("group flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-electric text-white shadow-sm"
            : "border border-white/10 bg-white/[0.04] text-foreground"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : message.content ? (
          <>
            <FormattedMarkdown text={message.content} />
            <div className="mt-1.5 flex justify-end">
              <button
                type="button"
                onClick={copy}
                className="rounded-md px-1.5 py-0.5 text-xs text-muted opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-foreground"
                aria-label="Copiar respuesta"
              >
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </>
        ) : (
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-electric/60" aria-label="Generando" />
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
  // Order matters: markdown links first, then bold/italic/code.
  const regex = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...renderPlainSegment(text.slice(lastIndex, match.index), `t-${key++}`));
    }
    const token = match[0];
    if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <ChatLink key={key++} href={linkMatch[2]}>
            {linkMatch[1]}
          </ChatLink>
        );
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={key++} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key++} className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs">
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
  if (lastIndex < text.length) {
    nodes.push(...renderPlainSegment(text.slice(lastIndex), `t-${key++}`));
  }
  return nodes;
}

// Detect bare URLs in a plain segment and render them as clickable links.
function renderPlainSegment(segment: string, baseKey: string): React.ReactNode[] {
  if (!segment) return [];
  const urlRegex = /(https?:\/\/[^\s)]+)/g;
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = urlRegex.exec(segment)) !== null) {
    if (match.index > lastIndex) result.push(segment.slice(lastIndex, match.index));
    result.push(
      <ChatLink key={`${baseKey}-u-${key++}`} href={match[0]}>
        {match[0]}
      </ChatLink>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < segment.length) result.push(segment.slice(lastIndex));
  return result;
}

function ChatLink({ href, children }: { href: string; children: React.ReactNode }) {
  const isInternal = href.startsWith("/");
  if (isInternal) {
    return (
      <Link href={href} className="text-electric underline-offset-2 hover:underline">
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-electric underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

function FormattedMarkdown({ text }: { text: string }) {
  const enriched = useMemo(() => linkifyKnownGames(text), [text]);
  const blocks = useMemo(() => parseBlocks(enriched), [enriched]);
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
            block.level === 2 ? "text-sm font-bold text-foreground" : "text-sm font-semibold text-foreground";
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

// Replace "(slug: my-game)" hint emitted by the model — and bare **Title** tokens that
// match data already mentioned — with markdown links. Keeps it conservative: we only
// transform tokens of the form (slug: foo-bar) immediately following a bolded title.
function linkifyKnownGames(text: string) {
  return text.replace(
    /\*\*([^*]+)\*\*\s*\(slug:\s*([a-z0-9][a-z0-9-]+)\)/g,
    (_match, title: string, slug: string) => `[**${title}**](/games/${slug})`
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
