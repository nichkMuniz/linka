import * as React from "react";
import { ChevronLeft, MessageCircle, Plus, Send, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";

type Conversation = {
  id: string;
  name: string;
  handle: string;
  lastMessage: string;
  time: string;
};

type Message = {
  id: string;
  from: "me" | "them";
  text: string;
  time: string;
};

const conversationsSeed: Conversation[] = [
  {
    id: "c1",
    name: "Ana",
    handle: "@ana.fit",
    lastMessage: "Bora manter o ritmo hoje?",
    time: "2 min",
  },
  {
    id: "c2",
    name: "Bruno",
    handle: "@bruno.nutri",
    lastMessage: "Lembra: constância > perfeição.",
    time: "1 h",
  },
];

const messagesSeed: Record<string, Message[]> = {
  c1: [
    { id: "m1", from: "them", text: "Bora manter o ritmo hoje?", time: "2 min" },
    { id: "m2", from: "me", text: "Fechado. Posto meu treino já já!", time: "agora" },
  ],
  c2: [
    {
      id: "m3",
      from: "them",
      text: "Lembra: constância > perfeição.",
      time: "1 h",
    },
    { id: "m4", from: "me", text: "Boa. Hoje vou cumprir o básico.", time: "55 min" },
  ],
};

const suggestedPeople: Array<{ name: string; handle: string }> = [
  { name: "Ana", handle: "@ana.fit" },
  { name: "Bruno", handle: "@bruno.nutri" },
  { name: "Camila", handle: "@camila.run" },
  { name: "Diego", handle: "@diego.cross" },
];

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function AvatarCircle({ label }: { label: string }) {
  return (
    <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-3 via-brand to-brand-2 text-sm font-semibold text-white shadow-sm ring-1 ring-brand/20">
      {label}
    </div>
  );
}

function timeNowLabel() {
  return "agora";
}

export default function Messages() {
  const [conversations, setConversations] = React.useState<Conversation[]>(conversationsSeed);
  const [messagesById, setMessagesById] = React.useState<Record<string, Message[]>>(messagesSeed);
  const [activeId, setActiveId] = React.useState<string>("");
  const [text, setText] = React.useState("");
  const [newDialogOpen, setNewDialogOpen] = React.useState(false);
  const [newQuery, setNewQuery] = React.useState("");

  const active = React.useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );
  const msgs = messagesById[activeId] ?? [];

  const send = () => {
    if (!activeId) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const msg: Message = {
      id: uid("m"),
      from: "me",
      text: trimmed,
      time: timeNowLabel(),
    };

    setMessagesById((prev) => ({
      ...prev,
      [activeId]: [...(prev[activeId] ?? []), msg],
    }));

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId ? { ...c, lastMessage: trimmed, time: timeNowLabel() } : c,
      ),
    );

    setText("");
  };

  const startConversation = (person: { name: string; handle: string }) => {
    const existing = conversations.find((c) => c.handle === person.handle);
    if (existing) {
      setActiveId(existing.id);
      setNewDialogOpen(false);
      setNewQuery("");
      return;
    }

    const id = uid("c");
    const conv: Conversation = {
      id,
      name: person.name,
      handle: person.handle,
      lastMessage: "",
      time: timeNowLabel(),
    };

    setConversations((prev) => [conv, ...prev]);
    setMessagesById((prev) => ({ ...prev, [id]: [] }));
    setActiveId(id);
    setNewDialogOpen(false);
    setNewQuery("");
    setText("");
  };

  const filteredSuggestions = React.useMemo(() => {
    const term = newQuery.trim().toLowerCase();
    if (!term) return suggestedPeople;
    return suggestedPeople.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.handle.toLowerCase().includes(term),
    );
  }, [newQuery]);

  const isMobile = useIsMobile();
  const goBackToList = () => {
    setActiveId("");
    setText("");
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Mensagens</h1>
        <p className="text-sm text-muted-foreground">
          Mensagens privadas para incentivar e combinar rotina com amigos.
        </p>
      </div>

      {isMobile ? (
        active ? (
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 rounded-full"
                  aria-label="Voltar"
                  onClick={goBackToList}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <User className="h-4 w-4 text-brand" />
                {`${active.name} (${active.handle})`}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="max-h-[60vh] space-y-2 overflow-auto rounded-2xl border border-border/60 bg-muted/20 p-3">
                {msgs.length ? (
                  msgs.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex",
                        m.from === "me" ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ring-1",
                          m.from === "me"
                            ? "bg-brand text-white ring-brand/20"
                            : "bg-background text-foreground ring-border/60",
                        )}
                      >
                        <div>{m.text}</div>
                        <div
                          className={cn(
                            "mt-1 text-[11px]",
                            m.from === "me" ? "text-white/80" : "text-muted-foreground",
                          )}
                        >
                          {m.time}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid place-items-center py-10 text-sm text-muted-foreground">
                    Sem mensagens ainda. Diga oi.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Escreva uma mensagem..."
                  className="h-11 rounded-full"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <Button
                  type="button"
                  className="h-11 w-11 rounded-full p-0"
                  onClick={send}
                  aria-label="Enviar"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-brand" />
                  Conversas
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 rounded-full"
                  aria-label="Nova conversa"
                  onClick={() => setNewDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 px-3 py-2 text-left transition hover:bg-muted/50",
                  )}
                  onClick={() => setActiveId(c.id)}
                >
                  <div className="flex items-center gap-3">
                    <AvatarCircle label={c.name.slice(0, 1).toUpperCase()} />
                    <div className="leading-tight">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.handle}</div>
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {c.lastMessage ? c.lastMessage : "Comece uma conversa"}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{c.time}</div>
                </button>
              ))}
            </CardContent>
          </Card>
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-[0.95fr_1.5fr]">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-brand" />
                  Conversas
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 rounded-full"
                  aria-label="Nova conversa"
                  onClick={() => setNewDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {conversations.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 px-3 py-2 text-left transition",
                      isActive ? "bg-muted" : "hover:bg-muted/50",
                    )}
                    onClick={() => setActiveId(c.id)}
                  >
                    <div className="flex items-center gap-3">
                      <AvatarCircle label={c.name.slice(0, 1).toUpperCase()} />
                      <div className="leading-tight">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.handle}</div>
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {c.lastMessage ? c.lastMessage : "Comece uma conversa"}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{c.time}</div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-brand" />
                {active ? `${active.name} (${active.handle})` : "Selecione uma conversa"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {!active ? (
                <div className="grid place-items-center rounded-2xl border border-border/60 bg-muted/20 p-8 text-center">
                  <div className="text-sm font-semibold">Abra uma conversa</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Clique em um nome à esquerda para ver o histórico.
                  </div>
                </div>
              ) : (
                <>
                  <div className="max-h-[52vh] space-y-2 overflow-auto rounded-2xl border border-border/60 bg-muted/20 p-3">
                    {msgs.length ? (
                      msgs.map((m) => (
                        <div
                          key={m.id}
                          className={cn(
                            "flex",
                            m.from === "me" ? "justify-end" : "justify-start",
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ring-1",
                              m.from === "me"
                                ? "bg-brand text-white ring-brand/20"
                                : "bg-background text-foreground ring-border/60",
                            )}
                          >
                            <div>{m.text}</div>
                            <div
                              className={cn(
                                "mt-1 text-[11px]",
                                m.from === "me"
                                  ? "text-white/80"
                                  : "text-muted-foreground",
                              )}
                            >
                              {m.time}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="grid place-items-center py-10 text-sm text-muted-foreground">
                        Sem mensagens ainda. Diga oi.
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Escreva uma mensagem..."
                      className="h-11 rounded-full"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          send();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      className="h-11 w-11 rounded-full p-0"
                      onClick={send}
                      aria-label="Enviar"
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova conversa</DialogTitle>
            <DialogDescription>
              Escolha uma pessoa para começar do zero.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <Input
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
              placeholder="Buscar pessoa por nome ou @..."
              className="h-11 rounded-full"
            />

            <div className="grid gap-2">
              {filteredSuggestions.map((p) => (
                <button
                  key={p.handle}
                  type="button"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 px-3 py-2 text-left transition hover:bg-muted/50"
                  onClick={() => startConversation(p)}
                >
                  <div className="flex items-center gap-3">
                    <AvatarCircle label={p.name.slice(0, 1).toUpperCase()} />
                    <div className="leading-tight">
                      <div className="text-sm font-semibold">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.handle}</div>
                    </div>
                  </div>
                  <Button type="button" variant="outline" className="rounded-full">
                    Conversar
                  </Button>
                </button>
              ))}

              {!filteredSuggestions.length ? (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                  Nenhuma pessoa encontrada.
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
