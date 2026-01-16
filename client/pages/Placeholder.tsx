import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Placeholder({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Em construção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Quer que eu finalize esta tela agora? Diga exatamente o que precisa
            (conteúdo, campos e comportamento) e eu monto a próxima versão.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="rounded-full">
              <Link to="/">Voltar ao feed</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/criar">Criar uma meta</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
