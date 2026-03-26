# Tela: Página Não Encontrada (404)

**Rota:** `*` (qualquer rota não mapeada)
**Arquivo:** `client/pages/NotFound.tsx`
**Layout:** AppLayout

---

## Objetivo

Tela de erro exibida quando o usuário tenta acessar uma rota que não existe no aplicativo.

---

## Estrutura Visual

```
┌──────────────────────────────────┐
│  Página não encontrada           │
│  Não existe rota para /xxx       │
├──────────────────────────────────┤
│  Card                            │
│  🔍 404                          │
│  ─────────────────────────────   │
│  Mensagem de ajuda               │
│  [← Voltar ao feed]              │
└──────────────────────────────────┘
```

---

## Conteúdo

### Título
"Página não encontrada"

### Subtítulo
"Não existe rota para `[pathname atual]`" — exibe a URL que o usuário tentou acessar em fonte monospace.

### Card 404
- Ícone `Search` + código "404"
- Mensagem: _"Se você clicou em algum link, me diga qual tela queria abrir que eu adiciono no app."_
- Botão **"← Voltar ao feed"** → navega para `/`

---

## Dados Carregados

Nenhum — tela completamente estática.

---

## Observações

- Usa `useLocation()` para exibir o pathname que gerou o erro
- O tom da mensagem é amigável e conversacional, condizente com a vibe do app
