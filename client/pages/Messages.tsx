import * as React from "react";
import { MessageCircle, Send, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

function AvatarCircle({ label }: { label: string }) {
  return (
    <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-3 via-brand to-brand-2 text-sm font-semibold text-white shadow-sm ring-1 ring-brand/20">
      {label}
    </div>
  );
}

export default function Messages() {
  const [activeId, setActiveId] = React.useState(conversationsSeed[0]?.id ?? "");
  const [text, setText] = React.useState("");

  const active = conversationsSeed.find((c) => c.id === activeId);
  const msgs = messagesSeed[activeId] ?? [];

  const send = () => {
    if (!text.trim()) return;
    // MVP: sem persistência real. Mantém foco no layout.
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

      <div className="grid gap-4 md:grid-cols-[0.95fr_1.5fr]">
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4 text-brand" />
              Conversas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {conversationsSeed.map((c) => {
              const active = c.id === activeId;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 px-3 py-2 text-left transition",
                    active ? "bg-muted" : "hover:bg-muted/50",
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
                        {c.lastMessage}
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
            <div className="max-h-[52vh] space-y-2 overflow-auto rounded-2xl border border-border/60 bg-muted/20 p-3">
              {msgs.map((m) => (
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
              ))}
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
      </div>
    </div>
  );
}
