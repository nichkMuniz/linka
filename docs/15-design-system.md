# Design System — RitmoFit

> Fonte de verdade para decisões visuais e de componentes. Toda nova tela ou componente deve seguir este documento.

---

## 0. Leia primeiro — o app é dark-only e glass-first (2026-07-13)

Duas premissas que valem **acima** de qualquer outra seção deste documento. Elas foram cravadas aqui porque a doc havia se descolado do app: descrevia um sistema light/dark de tokens semânticos que o app deixou de ser, e quem a consultasse para criar uma tela nova produziria algo que destoa de todas as outras.

### 0.1 Não existe light mode

O tema é **forçado em dark** (`forcedTheme="dark"` em `client/components/layout/theme-provider.tsx`). Não há toggle, não há `prefers-color-scheme`. A seção [14. Dark Mode](#14-dark-mode) descreve a mecânica dos tokens, mas **na prática só o modo escuro renderiza** — não gaste esforço validando aparência em claro, e não escreva CSS condicional de tema.

### 0.2 Superfícies de conteúdo são "glass", não `bg-card`

O visual atual do app (feed, metas, busca, comunidade, notificações, vitrine, drawers) é o **vidro escuro**: gradiente translúcido + `backdrop-filter` + borda clara sutil. Isso convive com — mas **não é** — o sistema de tokens Shadcn.

| Contexto | O que usar |
|---|---|
| Drawers/sheets de conteúdo rico | Tokens de `client/lib/glass-styles.ts` (§9.4) — **nunca** redefinir inline |
| Barra de ação de post, header, bottom nav | Glass inline (ver `GLASS_TOP`/`GLASS_ACTION` em `client/lib/post-visuals.tsx`) |
| Cards de lista/superfície comum | Glass: `linear-gradient(rgba(255,255,255,.09),rgba(255,255,255,.03))` + `backdrop-filter: blur(20px) saturate(170%)` + `border: 1px solid rgba(255,255,255,.10)` |
| Botões, inputs, dialogs, dropdowns, toasts | Componentes Shadcn com tokens semânticos (`bg-background`, `text-muted-foreground`, …) |

Ou seja: a regra "nunca hardcode cor" (§15) continua valendo para **tudo que não é a camada de vidro**. A camada de vidro tem valores `rgba()` literais por natureza — mas eles devem vir de uma constante compartilhada (`glass-styles.ts`, `post-visuals.tsx`), não ser reinventados em cada arquivo.

### 0.3 Custo do `backdrop-filter` (regra de performance)

`backdrop-filter` e `filter: blur()` são as propriedades mais caras do WebKit, e o WKWebView do iPhone paga por elas **a cada frame de scroll**, mesmo quando o elemento está parado.

- **Não** empilhe blur decorativo: brilhos de fundo ("auras", "orbs") devem ser `radial-gradient` pintado direto, **nunca** um `div` com `filter: blur(65px)`. Feed, Metas e Notificações já foram convertidos (2026-07-13)
- Reserve `backdrop-filter` para o que precisa mesmo do efeito de vidro sobre conteúdo em movimento: header, bottom nav, barras de ação e drawers
- `saturate()` junto do `blur()` aproximadamente dobra o custo do filtro — use com parcimônia

---

## Índice

0. [Leia primeiro — dark-only e glass-first](#0-leia-primeiro--o-app-é-dark-only-e-glass-first-2026-07-13)
1. [Fundação Visual](#1-fundação-visual)
2. [Tipografia](#2-tipografia)
3. [Espaçamento](#3-espaçamento)
4. [Bordas e Arredondamento](#4-bordas-e-arredondamento)
5. [Sombras e Elevação](#5-sombras-e-elevação)
6. [Componentes — Botões](#6-componentes--botões)
7. [Componentes — Cards](#7-componentes--cards)
8. [Componentes — Formulários](#8-componentes--formulários)
9. [Componentes — Modais e Drawers](#9-componentes--modais-e-drawers)
10. [Componentes — Feedback e Estados](#10-componentes--feedback-e-estados)
11. [Ícones](#11-ícones)
12. [Layout e Grid](#12-layout-e-grid)
13. [Animações e Transições](#13-animações-e-transições)
14. [Dark Mode](#14-dark-mode)
15. [Padrões de Uso (Do's & Don'ts)](#15-padrões-de-uso-dos--donts)

---

## 1. Fundação Visual

### 1.1 Paleta de Cores

As cores são definidas via **CSS Custom Properties (HSL)** no `index.css` e consumidas pelo Tailwind como tokens semânticos. Nunca use valores hexadecimais hardcoded — use sempre os tokens.

#### Tokens Semânticos

| Token | Uso | Light | Dark |
|---|---|---|---|
| `background` | Fundo de página | `hsl(214, 40%, 97%)` | `hsl(214, 35%, 9%)` |
| `foreground` | Texto principal | `hsl(214, 35%, 10%)` | `hsl(0, 0%, 98%)` |
| `card` | Fundo de cards | `hsl(214, 30%, 99%)` | `hsl(214, 30%, 12%)` |
| `card-foreground` | Texto dentro de cards | igual a `foreground` | igual a `foreground` |
| `primary` | Ação principal, azul da marca | `hsl(214, 100%, 61%)` | `hsl(214, 100%, 65%)` |
| `primary-foreground` | Texto sobre `primary` | branco | branco |
| `secondary` | **Accent roxo da marca** (`--brand-3`) — NÃO é superfície neutra | `hsl(263, 30%, 94%)` | `hsl(263, 70%, 65%)` |
| `muted` | Superfície neutra de chips/badges/botões secundários e divisores | `hsl(220, 16%, 95%)` | `hsl(232, 25%, 9%)` |
| `muted-foreground` | Texto de suporte, metadados | `hsl(220, 10%, 42%)` | `hsl(0, 0%, 54%)` |
| `accent` | Hover de elementos interativos | | |
| `destructive` | Ações perigosas, erros | vermelho | vermelho |
| `border` | Bordas padrão | | |
| `ring` | Focus ring | | |

#### Cores da Marca (Brand)

```css
/* Gradiente principal — azul → roxo → laranja */
background: linear-gradient(135deg, #3A8DFF 0%, #7B3FF2 50%, #FF8A2A 100%);
```

| Nome | Hex | HSL | Uso |
|---|---|---|---|
| Brand Blue | `#3A8DFF` | `hsl(214, 100%, 61%)` | Cor primária, CTA principal |
| Brand Purple | `#7B3FF2` | `hsl(263, 89%, 60%)` | Gradiente do meio |
| Brand Orange | `#FF8A2A` | `hsl(28, 100%, 58%)` | Cor de energia, destaque |

**Classes utilitárias disponíveis:**
- `.bg-brand-gradient` — aplica o gradiente como background
- `.text-brand-gradient` — aplica o gradiente em texto (via background-clip)

#### Cores de Estado e Categoria

| Contexto | Cor | Classes Tailwind |
|---|---|---|
| Apoio / Curtidas | Rosa | `text-rose-400`, `bg-rose-500/10` |
| Fogo / Energia | Laranja | `text-orange-400`, `bg-orange-500/10` |
| Conquista / Troféu | Amarelo | `text-amber-400`, `bg-yellow-500/10` |
| Evolução / Crescimento | Verde | `text-emerald-400`, `bg-green-500/10` |
| Força / Motivação | Azul | `text-blue-400`, `bg-blue-500/10` |
| Raio / Energia | Amarelo brilhante | `text-yellow-400` |
| Novo seguidor | Azul | `bg-blue-500/10`, `border-blue-200/50` |
| Novo comentário | Roxo | `bg-purple-500/10`, `border-purple-200/50` |
| Duelo | Laranja | `bg-orange-500/10`, `border-orange-700/40` |
| Equipamento | Azul | `bg-blue-500/15 text-blue-400` |
| Suplemento | Roxo | `bg-purple-500/15 text-purple-400` |
| Alimento | Verde | `bg-green-500/15 text-green-400` |
| Vestuário | Rosa | `bg-pink-500/15 text-pink-400` |
| Serviço | Laranja | `bg-orange-500/15 text-orange-400` |

> **Regra:** Opacidade `/10` ou `/15` para fundos de badges/notificações. Opacidade `/40` ou `/50` para bordas. Sempre use a versão `400` ou `500` para texto sobre fundo claro/escuro respectivamente.

---

## 2. Tipografia

### 2.1 Font Family

```css
font-family: 'Inter', sans-serif;
```

Importada via Google Fonts. Pesos utilizados: **400, 500, 600, 700, 800**.

### 2.2 Escala Tipográfica

| Classe Tailwind | Tamanho | Uso |
|---|---|---|
| `text-[11px]` | 11px | Labels de navegação mobile, hints mínimos |
| `text-xs` | 12px | Badges, metadados, timestamps |
| `text-sm` | 14px | Descrições, textos secundários, labels |
| `text-base` | 16px | Corpo de texto, parágrafos |
| `text-lg` | 18px | Subtítulos, nomes de usuário em destaque |
| `text-xl` | 20px | Títulos de seção |
| `text-2xl` | 24px | Títulos principais de página |
| `text-3xl+` | 30px+ | Evitar — reservar para landing pages |

### 2.3 Font Weight

| Classe | Peso | Uso |
|---|---|---|
| `font-normal` | 400 | Corpo de texto corrido |
| `font-medium` | 500 | Texto de destaque sutil |
| `font-semibold` | 600 | Títulos, labels de ação |
| `font-bold` | 700 | Títulos principais, valores numéricos importantes |

### 2.4 Combinações Recomendadas

```
Título de página:     text-2xl font-bold
Subtítulo de seção:   text-lg font-semibold
Nome de usuário:      text-sm font-semibold
Texto de suporte:     text-sm text-muted-foreground
Badge / Label:        text-xs font-medium
Timestamp:            text-xs text-muted-foreground font-mono
```

---

## 3. Espaçamento

O projeto usa a escala padrão do Tailwind (base 4px).

### 3.1 Escala de Uso Frequente

| Valor | px | Uso típico |
|---|---|---|
| `gap-1` / `p-1` | 4px | Micro-espaços, ícones agrupados |
| `gap-1.5` / `p-1.5` | 6px | Botões pequenos, badges |
| `gap-2` / `p-2` | 8px | Espaço entre ícone e label |
| `gap-3` / `p-3` | 12px | Espaço entre elementos de um card |
| `gap-4` / `p-4` | 16px | Padding padrão de cards e containers |
| `gap-6` / `p-6` | 24px | CardHeader / CardContent (Shadcn padrão) |

### 3.2 Padrões de Layout

```
Row com ícone + texto:   flex items-center gap-2
Coluna de elementos:     flex flex-col gap-3
Separação entre cards:   space-y-3 ou gap-3
Padding de página:       p-4 (mobile) / p-6 (desktop)
```

---

## 4. Bordas e Arredondamento

### 4.1 Border Radius

| Classe | Valor | Uso |
|---|---|---|
| `rounded-full` | 9999px | Avatares, botões pill, badges status |
| `rounded-2xl` | 1rem+4px | Botões grandes, cards de destaque |
| `rounded-xl` | 1rem | Nav items ativos |
| `rounded-lg` | ~0.75rem | Cards padrão, containers |
| `rounded-md` | calc(var(--radius) - 2px) | Inputs, selects, elementos internos |
| `rounded-sm` | calc(var(--radius) - 6px) | Elementos muito pequenos |

> **Regra de ouro:** Botões de ação principal → `rounded-full`. Cards → `rounded-lg`. Inputs → `rounded-md`.

### 4.2 Bordas

```
Borda padrão:         border border-border
Borda sutil:          border border-border/40
Borda de ênfase:      border border-border/60
Borda colorida:       border border-blue-200/50
Sem borda:            border-0 ou remover a classe border
```

---

## 5. Sombras e Elevação

| Classe | Uso |
|---|---|
| `shadow-sm` | Cards padrão, elevação sutil |
| `shadow-md` | Drawers, dropdowns |
| `shadow-lg` | Modais, FABs |
| `shadow-xl` | Elementos em destaque máximo |

> O projeto usa sombras com moderação. Preferir bordas (`border-border/40`) a sombras pesadas para separar elementos.

---

## 6. Componentes — Botões

### 6.1 Variantes

| Variante | Uso | Exemplo visual |
|---|---|---|
| `default` | Ação principal (CTA) | Fundo azul, texto branco |
| `outline` | Ação secundária | Borda com fundo transparente |
| `ghost` | Ação terciária, ícones | Apenas hover visível |
| `secondary` | Botão com accent roxo da marca (use com `secondary-foreground`, nunca com `muted-foreground`) | Fundo roxo |
| `destructive` | Ações perigosas | Fundo vermelho |
| `link` | Navegação em texto | Texto azul sublinhado |

> O `hover:` de cada variante **só existe no navegador de dev** (ver §13.4). No device o feedback vem do `active:scale-[0.98]` que a base do `Button` já aplica — para outra intensidade, passe `active:scale-*` no `className` (o `cn`/tailwind-merge deixa o de fora vencer). A variante `ghost` fica sem estado visual em repouso no device: use-a só onde o próprio ícone já comunica a ação.

### 6.2 Tamanhos

| Size | Altura | Uso |
|---|---|---|
| `sm` | 36px (`h-9`) | Botões compactos, listas |
| `default` | 40px (`h-10`) | Botão padrão |
| `lg` | 44px (`h-11`) | CTAs principais, formulários |
| `icon` | 40x40px (`h-10 w-10`) | Botões apenas com ícone |

### 6.3 Padrões de Uso

```tsx
// CTA principal de uma tela
<Button className="w-full rounded-full" size="lg">
  Publicar
</Button>

// Ação secundária
<Button variant="outline" size="sm" className="rounded-full">
  Editar
</Button>

// Botão de ícone (ghost)
<Button variant="ghost" size="icon">
  <Heart className="h-5 w-5" />
</Button>

// Botão destrutivo
<Button variant="destructive" className="rounded-full">
  Excluir conta
</Button>
```

### 6.4 Regras

- **Sempre** use `rounded-full` em botões de ação principal e secundária
- Botões de largura total (`w-full`) em formulários e drawers
- Nunca misture `rounded-lg` e `rounded-full` no mesmo grupo de botões
- Estados `disabled`: opacity-50 é aplicado automaticamente — não force visualmente
- Gap entre ícone e texto: sempre `gap-2`

### 6.5 Seletor de Estilo (fileira de chips horizontais)

Padrão para deixar o usuário escolher entre **variações visuais do mesmo conteúdo** (ex.: qual template de card compartilhar) sem abrir um drawer/dialog — introduzido no seletor de estilo do card gerado no resumo de treino (`workout-summary-overlay.tsx`, `goals_canvas_style_label`).

{% raw %}
```tsx
<div style={{ display: "flex", gap: 8, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
  {options.map((opt) => {
    const selected = value === opt.id;
    return (
      <button
        key={opt.id}
        onClick={() => setValue(opt.id)}
        style={{
          flexShrink: 0, padding: "9px 14px", borderRadius: 20,
          background: selected ? `${opt.accent}22` : CARD,
          border: `1.5px solid ${selected ? `${opt.accent}66` : BORDER}`,
          color: selected ? opt.accent : MUTED,
          fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        <span aria-hidden>{opt.emoji}</span>
        {opt.label}
      </button>
    );
  })}
</div>
```
{% endraw %}

- Container com `overflowX:auto` + `WebkitOverflowScrolling:"touch"` (nunca quebra linha) e `::-webkit-scrollbar{display:none}` para esconder a barra de rolagem no iOS.
- Chip selecionado: fundo e borda tingidos pela cor de acento da própria opção (`${accent}22` / `${accent}66`), texto na cor de acento. Chip não selecionado: `CARD`/`BORDER`/`MUTED` padrão (glass).
- `flexShrink: 0` em cada chip — obrigatório, senão o flex container espreme os últimos itens em vez de rolar.
- Emoji como indicador visual rápido da opção, à esquerda do label.
- Só liste opções que fazem sentido para os dados disponíveis (ex.: esconder uma opção que precisa de um valor > 0 quando esse valor é zero) em vez de mostrá-la desabilitada.
- Opções podem ser **geradas a partir dos dados**, não só fixas: no resumo de treino, cada modalidade de cardio feita na sessão (corrida, bike, remo…) vira um chip com emoji e cor próprios (`CARDIO_KIND_META` em `client/components/goals/cardio-canvas.ts`). Quando a opção gerada é claramente a mais relevante para aquela sessão, ela pode vir **pré-selecionada** — mas nunca esconda o padrão fixo ("Clássico") do restante da fileira.

### 6.6 Chip de filtro (fileira em superfície escura)

Variante do 6.5 para **filtrar uma lista** dentro de um sheet glass escuro — o chip selecionado é **branco sólido**, igual à alternância de abas do wizard, em vez de tingido por acento. Introduzido nos filtros do passo de montagem de rotina (`ChipToggle` em `create-wizard-drawer.tsx`: porção do músculo e Academia/Em casa).

```tsx
<button
  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all active:scale-95"
  style={active
    ? { background: "linear-gradient(rgba(255,255,255,.95),rgba(255,255,255,.84))", color: "#0a0b12" }
    : { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.65)" }}
>
```

- **Selecionado = branco** (mesmo gradiente da aba ativa), texto quase preto; não selecionado = vidro sutil com borda. Mantém a hierarquia com a alternância de abas logo acima: aba escolhe **como navegar**, chip **filtra** o que a navegação mostra.
- Poucas opções fixas e curtas (2–4, tipo Todos/Academia/Em casa) → `flex-1 justify-center` para dividir a largura em uma linha só. Quantidade variável ou rótulos longos (porções musculares: "Reto abdominal superior") → **rolagem horizontal**: `flex overflow-x-auto no-scrollbar` + `shrink-0` nos chips + `whitespace-nowrap`. Nunca `flex-wrap`: em 2–3 linhas a fileira de filtros empurra o conteúdo filtrado para fora da tela.
- Fileira rolável **dentro de drawer** precisa de `data-vaul-no-drag` no container, senão o gesto lateral disputa com o arraste do sheet (ver §"Swipe para fechar" dos drawers).
- Use `-mx-1 px-1` no container rolável para o chip ativo não ficar com a sombra/borda cortada na borda do sheet.
- Ícone opcional de 14px (`h-3.5 w-3.5`) à esquerda do label quando ele desambigua rápido (🏋️ academia × 🏠 casa).
- Um chip "Todos/Todas" abre a fileira e representa "sem filtro" — nunca deixe a fileira sem estado neutro.
- Se um filtro esvazia um agrupamento, **esconda o agrupamento** em vez de mostrá-lo com contagem 0.

---

## 7. Componentes — Cards

### 7.1 Card Padrão (Shadcn)

```tsx
<Card className="border-border/60">
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descrição</CardDescription>
  </CardHeader>
  <CardContent>
    {/* conteúdo */}
  </CardContent>
</Card>
```

### 7.2 Anatomia dos Tipos de Card

#### Card de Post (Feed)

```
┌─────────────────────────────────┐
│ [Avatar] Nome  @handle  · tempo │ ← Header: flex items-center gap-2
│─────────────────────────────────│
│                                 │
│     Imagem/Vídeo (aspect-square)│ ← Media container
│                                 │
│─────────────────────────────────│
│ Caption em text-sm              │ ← Corpo do post
│─────────────────────────────────│
│ [❤️ 12] [💬 3] [🔥 5]          │ ← Actions: flex items-center gap-4
└─────────────────────────────────┘
```

#### Card de Notificação

```
┌─────────────────────────────────────┐
│ [bg-blue-500/10] [border-blue-200/50]│
│ [Icon azul] Título em font-semibold  │
│             Descrição em text-sm     │
│             Tempo em text-xs muted   │
└─────────────────────────────────────┘
```

#### Card de Produto (vitrine)

```
┌────────────────────────────────────────┐
│ Imagem (aspect-video)                  │
│ [Badge categoria]          [💙 likes]  │
│ Título em font-semibold                │
│ Descrição em text-sm muted-foreground  │
│ R$ 99,90  ~~R$ 120,00~~               │
│ [Avatar] Nome do vendedor              │
└────────────────────────────────────────┘
```

### 7.3 Regras de Cards

- Borda padrão: `border-border/60` (não `border` puro)
- Rounded: `rounded-lg` (não `rounded-xl` ou `rounded-2xl`)
- Background: `card` token (não `background`)
- Padding de conteúdo: `p-4` (mobile) / `p-6` (CardContent padrão)

### 7.4 Thumbnail de vídeo (preview de frame) — Obrigatório

Qualquer `<video>` usado como **thumbnail/preview estático** (grade de shots, bolha de chat, preview de compartilhamento, arquivo de flows) deve ter o `src` passado por **`videoPosterSrc()`** (`client/lib/video-thumb.ts`), que anexa o media fragment `#t=0.1` à URL.

- **Motivo:** `<video preload="metadata">` sozinho **não pinta** frame no WKWebView do iOS — o elemento fica preto até dar play. O fragment força o WebView a fazer *seek* e pintar aquele frame, servindo de poster sem precisar de coluna de thumbnail no banco.
- **Sempre** acompanhar de `muted playsInline preload="metadata"` e, quando o tile é clicável para assistir, um glyph `Play` central (`pointer-events-none`).
- **Não** se aplica a `<video controls>` / players que já dão autoplay (viewer de shot, flow fullscreen) — esses tocam e pintam sozinhos.

```tsx
import { videoPosterSrc } from "@/lib/video-thumb";
<video src={videoPosterSrc(shot.video_url)} muted playsInline preload="metadata" className="... object-cover" />
```

---

## 8. Componentes — Formulários

### 8.1 Input

```tsx
<div className="space-y-1.5">
  <Label htmlFor="campo">Campo</Label>
  <Input id="campo" placeholder="Placeholder..." />
</div>
```

- Altura: `h-10` (padrão Shadcn)
- Rounded: `rounded-md`
- Border: `border-input`
- Focus: `ring-2 ring-ring ring-offset-2`

### 8.2 Textarea

```tsx
<Textarea
  placeholder="Escreva algo..."
  className="min-h-[80px] resize-none"
/>
```

### 8.3 Select

```tsx
<Select>
  <SelectTrigger className="rounded-md">
    <SelectValue placeholder="Escolha..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="opcao">Opção</SelectItem>
  </SelectContent>
</Select>
```

### 8.4 Grupo de Formulário (Padrão)

```
Espaçamento entre campos: space-y-4
Espaçamento entre label e campo: space-y-1.5
Botão de submit: w-full rounded-full (no final do form)
```

---

## 9. Componentes — Modais e Drawers

### 9.1 Quando usar Dialog vs Drawer

| Situação | Componente |
|---|---|
| Confirmação de ação (sim/não) | `AlertDialog` |
| Formulário simples (desktop-friendly) | `Dialog` |
| Painéis de conteúdo ricos no mobile | `Drawer` |
| Menus contextuais | `DropdownMenu` |
| Info rápida ao hover | `Tooltip` |

### 9.2 Dialog Padrão

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline">Abrir</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Título</DialogTitle>
      <DialogDescription>Descrição</DialogDescription>
    </DialogHeader>
    {/* conteúdo */}
    <DialogFooter>
      <Button variant="outline">Cancelar</Button>
      <Button>Confirmar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 9.3 Drawer Padrão (Mobile-first)

```tsx
<Drawer>
  <DrawerTrigger asChild>
    <Button>Abrir</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Título</DrawerTitle>
    </DrawerHeader>
    <div className="p-4">
      {/* conteúdo scrollável */}
    </div>
  </DrawerContent>
</Drawer>
```

### 9.4 Drawer Glass (Novo Design — Padrão Atual)

O padrão visual atual para drawers de conteúdo rico (promoções, duelos, comentários) é o **vidro escuro (glassmorphism)**: shell com gradiente escuro + blur, handle branco, cantos `!rounded-t-[32px]`, texto branco e campos/cards translúcidos. Independe do tema (sempre escuro).

**Fonte única de verdade:** `client/lib/glass-styles.ts`. Nunca redefina esses estilos inline — importe os tokens.

| Token | Uso |
|---|---|
| `GLASS_SHEET_PROPS` | Spread no `DrawerContent` (handle branco + `!rounded-t-[32px] !border-0`) |
| `GLASS_SHEET_STYLE` | `style` do `DrawerContent` (gradiente escuro + blur + `maxHeight: 90dvh`) |
| `GLASS_FIELD_STYLE` + `GLASS_FIELD_CLASS` | Inputs / Textareas / SelectTrigger |
| `GLASS_PRIMARY_BTN_STYLE` | Botão de ação principal (gradiente azul → roxo) |
| `GLASS_PANEL_STYLE` | Cards / containers translúcidos **dentro** de um sheet (o sheet já borra o fundo) |
| `GLASS_CARD_STYLE` | Cards / superfícies de vidro **sobre a página**, fora de sheets (listas, pills, botões de header) — traz `backdrop-filter` próprio. Ex.: tela do grupo de duelos |
| `GLASS_LABEL_CLASS` | Labels de formulário |

```tsx
import {
  GLASS_SHEET_PROPS, GLASS_SHEET_STYLE, GLASS_FIELD_STYLE,
  GLASS_FIELD_CLASS, GLASS_PRIMARY_BTN_STYLE, GLASS_LABEL_CLASS,
} from "@/lib/glass-styles";

<Drawer open={open} onOpenChange={setOpen} noBodyStyles shouldScaleBackground={false}>
  <DrawerContent {...GLASS_SHEET_PROPS} style={GLASS_SHEET_STYLE} onOpenAutoFocus={(e) => e.preventDefault()}>
    <DrawerHeader>
      <DrawerTitle className="text-white">Título</DrawerTitle>
    </DrawerHeader>
    {/* área scrollável precisa de flex-1 min-h-0 dentro do shell flex-col */}
    <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
      <label className={GLASS_LABEL_CLASS}>Campo</label>
      <Input className={GLASS_FIELD_CLASS} style={GLASS_FIELD_STYLE} />
      <Button className="w-full rounded-full border-0" style={GLASS_PRIMARY_BTN_STYLE}>Salvar</Button>
    </div>
  </DrawerContent>
</Drawer>
```

**Convenções de cor sobre o vidro:** texto principal `text-white`; secundário `rgba(255,255,255,.5)`; bordas/divisores `rgba(255,255,255,.1)`; botões `outline` ficam `bg-transparent border-white/20 text-white hover:bg-white/10`. Badges de categoria/estado (ex.: `bg-blue-500/15 text-blue-400`) já funcionam sobre o escuro.

> **Regra:** O `DrawerContent` base já eleva o sheet acima do teclado iOS — não recrie esse comportamento. A área scrollável deve usar `flex-1 min-h-0` (o shell é `flex flex-col`).

### 9.x Padrão Premium — `PremiumGate` + `PaywallDrawer` (2026-07-15)

Conteúdo exclusivo de assinante usa **sempre** estes dois componentes (nunca recriar blur/cadeado ad-hoc). Ver `docs/17-premium.md`.

```tsx
// Gate visual (gráficos, grades de dados): teaser borrado com dados reais
<PremiumGate feature="charts">
  <TrendChart points={points} ... />
</PremiumGate>

// Gate de AÇÃO (criar rotina/duelo): abre o paywall direto no handler
if (!isPremium && limiteAtingido) { setPaywallOpen(true); return; }
<PaywallDrawer open={paywallOpen} onOpenChange={setPaywallOpen} feature="routines" />
```

- `PremiumGate` (`client/components/shared/premium-gate.tsx`): children com `blur(8px)` + `pointer-events-none`, overlay com `Lock` âmbar, título e CTA que abre o `PaywallDrawer` interno. Assinante vê os children direto.
- `PaywallDrawer` (`client/components/shared/paywall-drawer.tsx`): drawer glass padrão (GLASS_SHEET_*) com `Crown`, os 4 benefícios em `GLASS_PANEL_STYLE` (o do `feature` recebido ganha `ring-[#9d6bff]/60`) e CTA `GLASS_PRIMARY_BTN_STYLE`. Fase 1: CTA mostra toast "em breve".
- Acento premium: âmbar (`text-amber-400/500`) para coroa/cadeado/selo "Premium"; o CTA usa o gradiente da marca.
- Status: `usePremium()` de `client/lib/premium-context.tsx` — nunca ler `subscriptions` direto num componente.

---

## 10. Componentes — Feedback e Estados

### 10.1 Toast (Obrigatório em ações assíncronas)

```tsx
const { toast } = useToast();

// Sucesso
toast({ title: "Publicado com sucesso!" });

// Erro
toast({
  title: "Erro ao publicar",
  description: "Tente novamente.",
  variant: "destructive"
});
```

> **Regra:** Todo `async/await` com efeito colateral visível (criar, editar, deletar, seguir) **deve** ter toast de sucesso e de erro.

### 10.2 Loading States

```tsx
// Spinner (ações rápidas)
import { LoadingSpinner } from "@/components/shared/animated-loading";
<LoadingSpinner />

// Dots (carregamentos de conteúdo)
<LoadingDots />

// Skeleton (listas e feeds)
<PostSkeleton />
<SkeletonLoader />
```

> **Regra:** Nunca mostre conteúdo vazio durante carregamento. Use sempre um skeleton ou spinner correspondente ao tipo de conteúdo.

### 10.3 Empty States

```tsx
<div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
  <IconRelevante className="h-10 w-10 text-muted-foreground" />
  <p className="text-sm text-muted-foreground">
    Nenhum conteúdo encontrado.
  </p>
  <Button variant="outline" size="sm">Ação sugerida</Button>
</div>
```

### 10.4 Estados de Botão com Loading

```tsx
<Button disabled={isLoading}>
  {isLoading ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    "Publicar"
  )}
</Button>
```

---

## 11. Ícones

### 11.1 Biblioteca

**Lucide React** é a biblioteca padrão. Não usar outras bibliotecas de ícones.

```tsx
import { Heart, MessageCircle, Home } from "lucide-react";
```

### 11.2 Tamanhos Padrão

| Tamanho | Classe | Uso |
|---|---|---|
| Tiny | `h-3 w-3` | Micro-indicadores |
| Small | `h-4 w-4` | Ícones em texto, badges |
| Medium | `h-5 w-5` | Ícones de ação padrão |
| Large | `h-6 w-6` | Navegação principal |
| XL | `h-8 w-8` | Ilustrações de empty state |
| XXL | `h-10 w-10` | Avatares, empty state ilustrativo |

### 11.3 Ícones por Contexto

| Contexto | Ícone |
|---|---|
| Feed / Home | `Home` |
| Busca | `Search` |
| Novo post | `PlusSquare` |
| Treinos | `Dumbbell` |
| Comunidade | `Users2` |
| Notificações | `Bell` |
| Shots/Reels | `Video` |
| vitrine | `ShoppingBag` |
| Perfil | (Avatar) |
| Curtir | `Heart` |
| Comentar | `MessageCircle` |
| Seguir | `UserPlus` |
| Seguindo | `UserCheck` |
| Enviar | `Send` |
| Deletar | `Trash2` |
| Editar | `Edit2` / `Pencil` |
| Mais opções | `MoreVertical` |
| Voltar | `ArrowLeft` / `ChevronLeft` |
| Configurações | `Settings` |
| Compartilhar | `Share2` |
| Fogo/Energia | `Flame` |
| Raio | `Zap` |
| Troféu | `Trophy` |
| Alvo/Meta | `Target` |
| Loading | `Loader2` (com `animate-spin`) |

---

## 12. Layout e Grid

### 12.1 Estrutura Geral

```
Desktop (md+):
┌──────────────┬─────────────────────┬──────────────┐
│  Sidebar     │   Feed/Conteúdo     │  (futuro)    │
│  244px fixed │   max-w-[680px]     │              │
│              │   mx-auto           │              │
└──────────────┴─────────────────────┴──────────────┘

Mobile:
┌───────────────────────────────────────┐
│ Top Header (fixed)                    │
├───────────────────────────────────────┤
│ Conteúdo (pt para header, pb para nav)│
├───────────────────────────────────────┤
│ Bottom Nav (fixed, 5 itens)           │
└───────────────────────────────────────┘
```

### 12.2 Breakpoints

O projeto usa apenas o breakpoint `md:` (768px) para separar mobile de desktop.

```css
/* Mobile-first */
.classe-mobile
md:classe-desktop
```

### 12.3 Containers Padrão

| Uso | Classes |
|---|---|
| Feed/Conteúdo central | `max-w-[680px] mx-auto w-full` |
| Sidebar | `w-[244px] shrink-0` |
| Página full-width | `w-full` |
| Centralização vertical | `flex items-center justify-center min-h-dvh` |

### 12.4 Grid Comum

```tsx
// Bottom Nav (5 itens)
<nav className="grid grid-cols-5">

// Duas colunas
<div className="grid grid-cols-2 gap-3">

// Emoji picker
<div className="grid grid-cols-8 gap-0.5">
```

### 12.5 Papel de parede de doodles (2026-08-13)

Fundo ladrilhado de doodles, no espírito do fundo do WhatsApp. Hoje é usado na **conversa privada** da Comunidade.

| Peça | Onde |
|---|---|
| Arte original | `public/background-mensagem.png` — fonte, não é a que a tela usa |
| Asset em uso | `public/chat-wallpaper.webp` — ladrilho 2600×1370 espelhado em 2×2, derivado da arte |
| Gerador | `scripts/build-chat-wallpaper.cjs` (`node scripts/build-chat-wallpaper.cjs`) |
| Classe | `.chat-doodle-wallpaper` (`client/global.css`, `@layer utilities`) — `background-size: 1240px auto`, `repeat`, opaca |

```tsx
// Dentro de um container posicionado (fixed/relative) e com overflow-hidden
<div aria-hidden="true" className="chat-doodle-wallpaper pointer-events-none absolute inset-0 -z-10" />
```

**Regras:**
- `-z-10` deixa a camada acima do `background` do próprio container e abaixo do conteúdo em fluxo; não é preciso dar `z-index` aos irmãos
- O container precisa de `overflow-hidden` e de posicionamento (`fixed`/`relative`)
- Decoração de fundo: sempre `aria-hidden` e `pointer-events-none`
- Ajuste de intensidade é por `filter: brightness()` na classe — **nunca** editando o arquivo de imagem
- **Não usar `background-size: cover`** em container que muda de altura (a conversa encolhe quando o teclado abre): o fundo re-escala e dá um zoom junto com a animação. Tamanho fixo em px não tem esse problema
- Ao trazer arte nova, verificar se ela é um **ladrilho contínuo**. Arte de tela (screenshot/wallpaper) quase nunca é — as figuras ficam cortadas nas bordas e o `repeat` cria emenda. A saída é espelhar (é o que o script faz) e dimensionar de modo que o quadrante fique **maior que a largura da tela**, para o eixo do espelho não aparecer

---

## 13. Animações e Transições

### 13.1 Classes Customizadas

```css
.transition-smooth      /* 300ms ease-out — padrão */
.transition-smooth-fast /* 150ms ease-out — hover rápido */
.transition-smooth-slow /* 500ms ease-out — entrada de tela */
```

### 13.2 Quando Usar Cada Animação

| Situação | Classe |
|---|---|
| Hover de botões/links | `transition-colors duration-150` |
| Hover de cards | `transition-all duration-200` |
| Abrir/fechar drawer | gerenciado pelo Shadcn/Vaul |
| Loading spinner | `animate-spin` (Loader2) |
| Skeleton loading | `animate-pulse` |
| Dots de carregamento | `animate-bounce` com delays |
| Micro-interação de reação | `hover:scale-125 transition-transform` |
| Botão pressionado | `active:scale-95` |

### 13.4 Hover não existe no device (obrigatório)

O alvo é iPhone/iPad: **nenhum feedback pode depender de `:hover`**.

- `tailwind.config.ts` liga `future.hoverOnlyWhenSupported: true` — toda utilitária `hover:`/`group-hover:` é compilada dentro de `@media (hover: hover) and (pointer: fine)`. No navegador de dev continua funcionando; no device simplesmente não existe. Isso mata o `:hover` grudento do WKWebView (elemento fica "aceso" depois do toque, como se um cursor tivesse parado nele) e o toque duplo que ele provoca — o primeiro toque num elemento com estilo de hover é gasto só aplicando o hover.
- **Todo controle precisa de um `active:`** (`active:scale-95`, `active:scale-[0.985]`, `active:bg-white/[.14]`). Sem isso o toque fica sem resposta nenhuma no device.
- **Nunca revele um controle só no hover** (`opacity-0 group-hover:opacity-100`): no device ele nunca aparece. Se o elemento existe apenas para ponteiro, tudo bem; se for necessário ao toque, mostre-o sempre ou use o escape hatch `[@media(hover:none)]:opacity-100` (é o que o `ToastClose` faz).
- `client/global.css` aplica em `button/[role=button]/a/label/summary`: `-webkit-touch-callout: none`, `user-select: none` e `touch-action: manipulation`. Arrastar o dedo sobre um controle não seleciona o rótulo (o que fazia parecer que a linha ficou "marcada" e exigia um toque só para desfazer). **Campos de texto ficam fora dessa regra** — lá a seleção é essencial.

### 13.3 Performance

- Use `will-change-transform` apenas em elementos animados frequentemente (FAB, reações)
- Prefira `transform` e `opacity` para animações (GPU-accelerated)
- Evite animar `width`, `height` ou `top/left` — causam reflow

---

## 14. Dark Mode

> **O app é dark-only** (`forcedTheme="dark"`) — ver §0.1. Esta seção descreve a mecânica dos tokens, que continua correta, mas o modo claro nunca renderiza em produção. Não escreva lógica condicional de tema nem valide telas em light.

### 14.1 Implementação

Via `next-themes` com atributo `class` na tag `<html>`, fixado em `dark`. As cores são ajustadas via CSS variables HSL.

### 14.2 Regras

- **Nunca hardcode cores** que não se adaptem ao dark mode. Use sempre os tokens semânticos (`text-foreground`, `bg-background`, `bg-card`, etc.)
- Para overlays e opacidades, use o padrão `/10` ou `/15` que funciona em ambos os modos
- Para lógica condicional de cor em componentes: `const { resolvedTheme } = useTheme()`

```tsx
// Correto — usa token semântico
<div className="bg-card text-foreground">

// Incorreto — hardcoded que quebra no dark mode
<div className="bg-white text-gray-900">
```

### 14.3 Ajustes de Cor no Dark Mode

As brand colors são levemente mais brilhantes no dark mode para manter o contraste:

| Token | Light | Dark |
|---|---|---|
| `primary` | 61% lightness | 65% lightness |
| brand-2 (laranja) | 58% lightness | 62% lightness |
| brand-3 (roxo) | 60% lightness | 65% lightness |

---

## 15. Padrões de Uso (Do's & Don'ts)

### ✅ Do's

- **Imagens de usuário:** sempre usar `<ImageWithFallback>` — nunca `<img>` direto
- **Ações assíncronas:** sempre toast de sucesso E erro
- **Loading:** sempre mostrar skeleton ou spinner — nunca conteúdo vazio
- **Botões de ação principal:** sempre `rounded-full`
- **Ícones:** sempre Lucide, tamanho `h-4 w-4` (pequeno) ou `h-5 w-5` (médio)
- **Cores:** sempre via tokens semânticos Tailwind
- **Tipografia:** sempre via classes Tailwind (não {% raw %}`style={{ fontSize }}`{% endraw %})
- **Bordas:** usar `border-border/40` ou `border-border/60` para bordas sutis
- **Gap entre ícone e texto:** sempre `gap-2`

### ❌ Don'ts

- Não use `<img>` diretamente para avatares ou fotos de usuário
- Não hardcode cores hex ou rgb em `style={}`
- Não crie um novo componente se um Shadcn já resolve
- Não misture `rounded-full` e `rounded-lg` no mesmo grupo de botões
- Não use `animate-spin` em spinner customizado — use `<LoadingSpinner>` do projeto
- Não use `text-gray-*` — use `text-muted-foreground`
- Não use `bg-white` ou `bg-black` — use `bg-background` ou `bg-foreground`
- Não omita toast em ações que salvam, deletam ou enviam dados
- Não use `min-h-screen` — prefira `min-h-dvh` (dynamic viewport height, melhor no mobile)
- Não crie shadow pesado (`shadow-2xl`) em cards do feed — use `shadow-sm` ou borda

---

## Apêndice — Checklist de Nova Tela

Antes de considerar uma tela pronta, verifique:

- [ ] Segue a paleta de cores via tokens semânticos
- [ ] Tipografia usa a escala definida neste documento
- [ ] Botões de ação principal têm `rounded-full`
- [ ] Imagens de usuário usam `<ImageWithFallback>`
- [ ] Todas as ações assíncronas têm toast de sucesso e erro
- [ ] Estado de loading tem skeleton ou spinner adequado
- [ ] Estado vazio (empty state) está implementado
- [ ] Funciona em dark mode (verificar com DevTools ou toggle)
- [ ] Layout responsivo: mobile (bottom nav) e desktop (sidebar) testados
- [ ] Ícones são Lucide, nos tamanhos corretos
- [ ] Nenhuma cor hardcoded em `style={}`
- [ ] O arquivo `docs/` correspondente foi atualizado
