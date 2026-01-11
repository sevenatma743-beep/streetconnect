import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function Page({ params }) {
  const { conversationId } = params;

  redirect(`/messages?conversation=${conversationId}`);
}