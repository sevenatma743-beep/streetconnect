"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ConversationRedirect({ params }) {
  const router = useRouter();
  const { conversationId } = params;

  useEffect(() => {
    router.replace(`/messages?conversation=${conversationId}`);
  }, [conversationId, router]);

  return null;
}
