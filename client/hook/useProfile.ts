import { useQuery } from "@tanstack/react-query";
import { getProfile, getUserPosts } from "@/services/profile.service";

export const useProfile = (userId: string) => {
  const profile = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfile(userId),
  });

  const posts = useQuery({
    queryKey: ["user-posts", userId],
    queryFn: () => getUserPosts(userId),
  });

  return { profile, posts };
};
