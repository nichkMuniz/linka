import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { listRankingDb } from "@/lib/ritmofit-db";

export default function Rank() {
  const { data, isLoading } = useQuery({
    queryKey: ["ranking"],
    queryFn: listRankingDb,
  });

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className="space-y-3">
      {data?.map((r: any, i: number) => (
        <div
          key={r.id}
          className="flex justify-between items-center border rounded p-3"
        >
          <div>
            <div className="font-medium">
              {i + 1}. {r.name}
            </div>
            <div className="text-xs text-muted-foreground">
              Level {r.level}
            </div>
          </div>
          <div className="font-semibold">{r.points} pts</div>
        </div>
      ))}
    </div>
  );
}
