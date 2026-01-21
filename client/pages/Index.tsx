import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Index() {
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("posts")
      .select("*, profiles(username, avatar_url)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setPosts(data || []));
  }, []);

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {posts.map((post) => (
        <div key={post.id} className="border rounded-xl p-4">
          <div className="font-semibold">@{post.profiles?.username}</div>
          <img src={post.image_url} className="rounded-lg my-2" />
          <p>{post.caption}</p>
        </div>
      ))}
    </div>
  );
}
