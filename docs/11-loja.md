# Tela: Loja

**Rota:** `/loja`
**Arquivo:** `client/pages/Store.tsx`
**Layout:** AppLayout

---

## Objetivo

Tela placeholder para a futura loja integrada do RitmoFit. Atualmente exibe uma página "Em breve" com preview das funcionalidades planejadas.

---

## Estrutura Visual

```
┌──────────────────────────────────┐
│  [Ícone Sacola]                  │
│  Loja RitmoFit                   │
│  Descrição                       │
│  [Badge "Em breve"]              │
├──────────────────────────────────┤
│  O que vem por aí:               │
│  [Equipamentos Fitness]          │
│  [Suplementos & Nutrição]        │
│  [Planos Premium]                │
│  [Programas de Treino]           │
├──────────────────────────────────┤
│  [Me avise quando abrir] (dis.)  │
└──────────────────────────────────┘
```

---

## Funcionalidades Atuais

### Estado Atual
- **Apenas informativo** — nenhuma funcionalidade de compra está ativa
- Badge "Em breve" indica que está em desenvolvimento

---

## Preview de Funcionalidades Futuras

| Categoria | Ícone | Cor | Descrição |
|---|---|---|---|
| Equipamentos Fitness | `ShoppingBag` | Brand | Pesos, elásticos, tapetes e acessórios para treino |
| Suplementos & Nutrição | `Zap` | Amarelo | Proteínas, vitaminas e produtos para complementar dieta |
| Planos Premium | `Trophy` | Verde esmeralda | Metas ilimitadas, rotinas avançadas e análises detalhadas |
| Programas de Treino | `Dumbbell` | Azul | Planos criados por personal trainers parceiros |

---

## Botões

| Botão | Estado | Ação |
|---|---|---|
| "Me avise quando abrir" | **Desabilitado** | Sem funcionalidade (futuro: cadastrar email de notificação) |

---

## Observações

- Esta tela é completamente estática — sem chamadas ao banco de dados
- Nenhum estado ou efeito colateral
- O botão de notificação está desabilitado (`disabled`) — não há funcionalidade de cadastro de interesse ainda
- A tela serve como placeholder para comunicar ao usuário o que está por vir
