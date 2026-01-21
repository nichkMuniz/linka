import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NewPost() {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");

  async function handlePost() {
    if (!file) return;

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return alert("Faça login");

    const filePath = `${user.id}/${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage
      .from("posts")
      .upload(filePath, file);

    if (error) return alert(error.message);

    const publicUrl = supabase.storage.from("posts").getPublicUrl(filePath)
      .data.publicUrl;

    await supabase.from("posts").insert({
      user_id: user.id,
      image_url: publicUrl,
      caption,
    });

    alert("Post publicado!");
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <textarea
        placeholder="Legenda..."
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />
      <button onClick={handlePost}>Publicar</button>
    </div>
  );
}
