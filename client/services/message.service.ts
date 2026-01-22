import { supabase } from "@/lib/supabase";

export const getConversations = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("messages")
    .select(
      `
      *,
      sender:sender_id (id, username, avatar_url),
      receiver:receiver_id (id, username, avatar_url)
    `,
    )
    .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};

export const sendMessage = async (toUserId: string, text: string) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("messages").insert({
    sender_id: user?.id,
    receiver_id: toUserId,
    content: text,
  });

  if (error) throw error;
};
