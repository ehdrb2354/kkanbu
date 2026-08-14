import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "../../../lib/supabase/admin";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

type WebhookPayload = {
  type: string;
  table: string;
  record: { id: string; meetup_id: string; sender_id: string; content: string };
};

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.PUSH_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await req.json()) as WebhookPayload;
  if (payload.type !== "INSERT" || payload.table !== "meetup_messages") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { meetup_id: meetupId, sender_id: senderId, content } = payload.record;
  const supabase = createAdminClient();

  const [{ data: meetup }, { data: sender }, { data: participants }] = await Promise.all([
    supabase.from("meetups").select("title").eq("id", meetupId).single(),
    supabase.from("profiles").select("nickname").eq("id", senderId).single(),
    supabase.from("meetup_participants").select("user_id").eq("meetup_id", meetupId).neq("user_id", senderId),
  ]);

  const participantIds = (participants ?? []).map((p) => p.user_id);
  if (participantIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", participantIds);

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const body = JSON.stringify({
    title: meetup?.title ? `🤝 ${meetup.title}` : "🤝 깐부톡",
    body: `${sender?.nickname ?? "깐부"}: ${content}`,
    meetupId,
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      )
    )
  );

  const staleIds: string[] = [];
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const statusCode = (result.reason as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) staleIds.push(subscriptions[i].id);
    }
  });

  if (staleIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", staleIds);
  }

  return NextResponse.json({ ok: true, sent: subscriptions.length - staleIds.length });
}
