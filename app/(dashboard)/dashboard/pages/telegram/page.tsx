import { redirect } from "next/navigation";

// Telegram is managed under its own menu now, not the Pages tabs. Keep this
// path alive so old links/bookmarks land in the right place.
export default function TelegramPagesRedirect() {
  redirect("/dashboard/telegram");
}
