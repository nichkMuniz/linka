async function handlePost() {
  if (!hasSupabaseConfig || !supabase) return;
  if (loading) return;

  if (!user) {
    toast({
      title: "Faça login",
      description: "Você precisa estar logado para publicar.",
    });
    navigate("/login");
    return;
  }

  if (!file) return;

  setBusy(true);
  try {
    const filePath = `${user.id}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("posts")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const publicUrl = supabase.storage
      .from("posts")
      .getPublicUrl(filePath).data.publicUrl;

    const { error: insertError } = await supabase.from("posts").insert({
      description: caption.trim(),
      photo: publicUrl,
      user_goal_id: 1, // ⚠️ coloque um ID válido da tabela user_goals
    });

    if (insertError) throw insertError;

    toast({
      title: "Post publicado!",
      description: "Sua foto já foi enviada.",
    });

    setFile(null);
    setCaption("");
    navigate("/", { replace: true });
  } catch (err: any) {
    toast({
      title: "Erro ao publicar",
      description: err.message,
    });
  } finally {
    setBusy(false);
  }
}
