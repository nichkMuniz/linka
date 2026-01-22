import { useQuery } from "@tanstack/react-query";
import { getFeedPosts } from "@/services/post.service";

export const useFeed = () => {
  return useQuery({
    queryKey: ["feed"],
    queryFn: getFeedPosts,
  });
};
