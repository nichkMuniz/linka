import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { listConversationsDb } from "@/lib/ritmofit-db";

export default function Messages() {
  const { data, isLoading } = useQuery({
    queryKey: ["messages"],
    queryFn: listConversationsDb,
  });

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className="divide-y">
      {data?.map((c: any) => (
        <div key={c.id} className="p-4">
          <div className="font-medium">{c.name}</div>
          <div className="text-sm text-muted-foreground">{c.lastMessage}</div>
        </div>
      ))}
    </div>
  );
}
