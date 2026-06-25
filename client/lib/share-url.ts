export const SHARE_BASE_URL = "https://linka.app";

export function profileShareUrl(userId: string): string {
  return `${SHARE_BASE_URL}/usuario/${userId}`;
}

export function postShareUrl(postId: string): string {
  return `${SHARE_BASE_URL}/post/${postId}`;
}
