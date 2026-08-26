import * as React from "react";
import {
  getConversationsDb,
  getFollowingDb,
  getRankingDb,
  invalidateQueryCache,
  type Conversation,
  type SearchUser,
  type RankingUser,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
// Tabs component replaced by custom underline tabs
import { toast } from "@/components/ui/use-toast";
import { MessageCircle, Users, Swords, BarChart2 } from "lucide-react";
import { CommunitySkeleton } from "@/components/shared/animated-loading";
import { useLanguage } from "@/lib/language-context";
import { RankingTab } from "@/components/community/ranking-tab";
import { RequestsTab } from "@/components/community/requests-tab";
import { useDuels, DuelsTab, DuelGroupView, DuelsOverlays } from "@/components/community/duels";
import {
  useMessages,
  ConversationView,
  MessagesTab,
  MessagesOverlays,
} from "@/components/community/messages";
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";


/**
 * Tela **Comunidade** — apenas a casca: abas, carga compartilhada
 * (conversas + seguidos + ranking) e roteamento entre as quatro abas.
 *
 * Cada aba é um módulo próprio, com o estado dela:
 * - Mensagens → `@/components/community/messages`
 * - Duelos    → `@/components/community/duels`
 * - Ranking   → `@/components/community/ranking-tab`
 * - Solicitações → `@/components/community/requests-tab`
 */
export default function Community() {
  const { user } = useAuth();
  const { t } = useLanguage();
  // A conversa de DM já encolhe com o teclado (bottom: --keyboard-height). Este
  // hook cobre os formulários dos drawers (criar duelo, check-in, editar grupo,
  // editar comentário) cujos campos ficam no meio do scroll. Ref-less: rola o
  // container ativo detectado a partir do campo em foco. Ver hook.
  useKeyboardInputScroll();

  const [activeTab, setActiveTab] = React.useState("messages");

  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [followers, setFollowers] = React.useState<SearchUser[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [ranking, setRanking] = React.useState<RankingUser[]>([]);

  const goToMessagesTab = React.useCallback(() => setActiveTab("messages"), []);

  // Aba Mensagens — lista, conversa aberta, envio, realtime e exclusão vivem
  // em `@/components/community/messages`. A tela segue dona de `conversations`
  // porque a carga inicial é um Promise.all com followers e ranking, e é ela
  // que decide quando esconder o skeleton.
  const messagesCtl = useMessages({
    conversations,
    setConversations,
    loading,
    isActive: activeTab === "messages",
    onRequestActive: goToMessagesTab,
  });

  // Aba Duelos — grupos, vista do grupo, check-ins, participantes, convites e
  // solicitações vivem em `@/components/community/duels`. As listas de convites
  // e pedidos de entrada saem de lá porque quem as carrega é o
  // `loadGroupsAndRequests` daquele domínio.
  const duelsCtl = useDuels({ activeTab, setActiveTab });

  /** Convites + pedidos de entrada — alimenta o badge do ícone de Solicitações. */
  const pendingRequestCount =
    duelsCtl.pendingInvites.length + duelsCtl.pendingGroupRequests.length;

  // Load conversations, following users, and ranking
  React.useEffect(() => {
    const loadData = async () => {
      try {
        const [conversationsData, followingData, rankingData] = await Promise.all([
          getConversationsDb(),
          getFollowingDb(),
          getRankingDb(),
        ]);
        setConversations(conversationsData);
        setFollowers(followingData);
        setRanking(rankingData);
      } catch (err: any) {
        console.error("Error loading community data:", err);
        toast({
          title: "Erro ao carregar dados",
          description: err?.message || "Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Ao (re)entrar na Comunidade e ao voltar do background, relê as conversas do
  // ZERO (cache invalidado). O `loadData` acima usa `getConversationsDb` cacheado
  // (TTL 60s) para o primeiro paint instantâneo — mas quem chegou aqui vindo de
  // outra tela após receber uma mensagem via push encontrava a lista velha, sem o
  // remetente novo. Este refresh roda em paralelo, fora do gate de `loading`:
  // pinta rápido do cache e, logo em seguida, atualiza com quem acabou de mandar.
  React.useEffect(() => {
    const refreshConversations = () => {
      invalidateQueryCache("conversations");
      getConversationsDb()
        .then(setConversations)
        .catch((err) => console.error("Error refreshing conversations:", err));
    };
    refreshConversations();
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshConversations();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);


  if (loading) {
    return <CommunitySkeleton />;
  }

  // A conversa privada é uma tela cheia própria (portal). Todo o seu estado
  // vive no `useMessages`; aqui só decidimos entre ela e o corpo da Comunidade.
  if (messagesCtl.isConversationOpen) {
    return <ConversationView ctl={messagesCtl} />;
  }

  return (
    <div
      className="w-full flex flex-col overflow-hidden"
      style={{
        // Altura fixa: o <main> compartilhado reserva ~64px de padding para a
        // pílula flutuante do header, que nesta tela fica sempre visível.
        height:
          "calc(100dvh - 64px - env(safe-area-inset-top) - 1.5rem - 4.75rem - env(safe-area-inset-bottom))",
      }}
    >
      {/* Tabs — segmented control style (igual à tela de Loja), sempre visível */}
      <div
        className="flex-shrink-0 px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}
      >
        <div className="flex items-center gap-3">
          {/* Segmented tabs */}
          <div
            className="flex flex-1 rounded-xl overflow-hidden py-1 px-1 gap-1"
            style={{
              background: "linear-gradient(rgba(255,255,255,.07),rgba(255,255,255,.02))",
              backdropFilter: "blur(20px) saturate(160%)",
              WebkitBackdropFilter: "blur(20px) saturate(160%)",
              border: "1px solid rgba(255,255,255,.10)",
            }}
          >
            <button
              onClick={() => setActiveTab("messages")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg transition-colors ${activeTab === "messages" ? "bg-brand text-white" : "text-white/50 hover:text-white/80"}`}
            >
              <MessageCircle className="h-4 w-4" />
              {t("community_messages")}
            </button>
            <button
              onClick={() => setActiveTab("duels")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg transition-colors ${activeTab === "duels" ? "bg-brand text-white" : "text-white/50 hover:text-white/80"}`}
            >
              <Swords className="h-4 w-4" />
              {t("community_duels")}
            </button>
            <button
              onClick={() => setActiveTab("ranking")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg transition-colors ${activeTab === "ranking" ? "bg-brand text-white" : "text-white/50 hover:text-white/80"}`}
            >
              <BarChart2 className="h-4 w-4" />
              {t("community_ranking")}
            </button>
          </div>

          {/* Solicitações pendentes — badge compacto */}
          {pendingRequestCount > 0 && (
            <button
              onClick={() => setActiveTab("requests")}
              aria-label={t("duels_requests_aria")}
              className={`relative p-2 rounded-lg transition-colors ${activeTab === "requests" ? "bg-brand text-white" : "text-white/50 hover:text-white/80"}`}
              style={activeTab !== "requests" ? { border: "1px solid rgba(255,255,255,.10)" } : undefined}
            >
              <Users className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center ring-2 ring-background font-bold">
                {pendingRequestCount}
              </span>
            </button>
          )}

        </div>
      </div>

      {/* Messages Tab */}
      {activeTab === "messages" && (
        <MessagesTab
          ctl={messagesCtl}
          conversations={conversations}
          followers={followers}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />
      )}

      {duelsCtl.selectedGroupForView && <DuelGroupView ctl={duelsCtl} />}

      {activeTab === "duels" && !duelsCtl.selectedGroupForView && (
        <DuelsTab ctl={duelsCtl} />
      )}

      {/* Ranking Tab */}
      {activeTab === "ranking" && (
        <RankingTab
          ranking={ranking}
          followers={followers}
          currentUserId={user?.id}
        />
      )}

      {/* Solicitações (Pending Invites + Group Join Requests) Tab */}
      {activeTab === "requests" && (
        <RequestsTab
          pendingInvites={duelsCtl.pendingInvites}
          setPendingInvites={duelsCtl.setPendingInvites}
          pendingGroupRequests={duelsCtl.pendingGroupRequests}
          setPendingGroupRequests={duelsCtl.setPendingGroupRequests}
          onReloadGroups={() => void duelsCtl.loadGroupsAndRequests({ fresh: true })}
          onOpenAcceptedGroup={(group) => {
            setActiveTab("duels");
            duelsCtl.openGroupView(group);
          }}
          onGoToDuels={() => setActiveTab("duels")}
        />
      )}

      {/* Overlays da aba Mensagens (nova conversa + excluir conversa) */}
      <MessagesOverlays ctl={messagesCtl} followers={followers} />

      <DuelsOverlays ctl={duelsCtl} followers={followers} />
    </div>
  );
}
