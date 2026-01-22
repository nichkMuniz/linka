import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { listReelsDb } from "@/lib/ritmofit-db";
import { AppLayout } from "@/components/app-layout";

export default function Reels() {
  const { data, isLoading } = useQuery({
    queryKey: ["reels"],
    queryFn: listReelsDb,
  });

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      {data?.map((reel: any) => (
        <div key={reel.id} className="rounded-lg overflow-hidden border">
          <video
            src={reel.video}
            controls
            className="w-full aspect-[9/16] object-cover"
          />
          <div className="p-3">
            <p className="font-medium">{reel.description}</p>
            <p className="text-xs text-muted-foreground">@{reel.author}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
