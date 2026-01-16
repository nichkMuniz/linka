import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          P1gina n3o encontrada
        </h1>
        <p className="text-sm text-muted-foreground">
          N3o existe rota para <span className="font-mono">{location.pathname}</span>.
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            404
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se voca clicou em algum link, me diga qual tela queria abrir que eu
            adiciono no app.
          </p>
          <Button asChild className="rounded-full">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao feed
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
