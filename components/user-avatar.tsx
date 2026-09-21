export function UserAvatar({ author, avatarUrl, size = "sm" }: { author?: string | null; avatarUrl?: string | null; size?: "sm" | "md" }) {
  const safeAuthor = (author || "?").replace(/^u\//, "");
  const initial = safeAuthor.slice(0, 1).toUpperCase() || "?";

  return (
    <span className={`user-avatar ${size}`} aria-label={author ? `Reddit user ${safeAuthor}` : "Reddit user"}>
      {avatarUrl ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span>{initial}</span>}
    </span>
  );
}
