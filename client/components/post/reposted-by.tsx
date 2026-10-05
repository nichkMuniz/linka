import * as React from "react";
import { Repeat2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FollowListDrawer } from "@/components/profile/follow-list-drawer";
import { useLanguage } from "@/lib/language-context";
import { hapticLight } from "@/lib/haptics";
import type { SearchUser } from "@/lib/ritmofit-db";

/**
 * "fulano repostou" — quem adicionou o post ao próprio perfil (estilo
 * Instagram: o post é UM só, com as mesmas curtidas e comentários no perfil
 * do autor e no de cada um que repostou). Um nome abre o perfil dele; dois ou
 * mais abrem a lista. Usado no card do feed/perfil e no detalhe do post.
 */
export function RepostedBy({
  users,
  className,
  style,
}: {
  users: SearchUser[];
  className?: string;
  style?: React.CSSProperties;
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [listOpen, setListOpen] = React.useState(false);
  if (users.length === 0) return null;
  const first = users[0];

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          hapticLight();
          if (users.length === 1) navigate(`/usuario/${first.id}`);
          else setListOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 max-w-full rounded-full pl-1.5 pr-2.5 py-1 active:opacity-70 transition-opacity ${className ?? ""}`}
        style={{ background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.14)", ...style }}
      >
        <Repeat2 className="h-3.5 w-3.5 shrink-0 text-white/80" />
        <UserAvatar photo={first.photo} nickname={first.nickname} className="h-4 w-4 shrink-0" />
        <span className="text-[11.5px] font-semibold text-white/90 truncate">
          {users.length === 1
            ? t("reposted_by_one").replace("{name}", first.nickname)
            : t("reposted_by_many")
                .replace("{name}", first.nickname)
                .replace("{n}", String(users.length - 1))}
        </span>
      </button>
      {users.length > 1 && (
        <FollowListDrawer
          open={listOpen}
          onOpenChange={setListOpen}
          type="following"
          title={t("reposted_by_title")}
          emptyMessage={t("reposted_by_title")}
          users={users}
          isLoading={false}
        />
      )}
    </>
  );
}
