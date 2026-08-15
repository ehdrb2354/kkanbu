import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "../../../lib/supabase/admin";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

type MeetupMessagePayload = {
  type: string;
  table: "meetup_messages";
  record: { id: string; meetup_id: string; sender_id: string; content: string };
};

type DirectMessagePayload = {
  type: string;
  table: "direct_messages";
  record: { id: string; sender_id: string; receiver_id: string; content: string };
};

type WebhookPayload = MeetupMessagePayload | DirectMessagePayload;

async function sendToSubscribers(
  supabase: ReturnType<typeof createAdminClient>,
  targetUserIds: string[],
  body: string
) {
  if (targetUserIds.length === 0) {
    return 0;
  }

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", targetUserIds);

  if (!subscriptions || subscriptions.length === 0) {
    return 0;
  }

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

  return subscriptions.length - staleIds.length;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.PUSH_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await req.json()) as WebhookPayload;
  if (payload.type !== "INSERT") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const supabase = createAdminClient();

  if (payload.table === "meetup_messages") {
    const { meetup_id: meetupId, sender_id: senderId, content } = payload.record;

    const [{ data: meetup }, { data: sender }, { data: participants }] = await Promise.all([
      supabase.from("meetups").select("title").eq("id", meetupId).single(),
      supabase.from("profiles").select("nickname").eq("id", senderId).single(),
      supabase.from("meetup_participants").select("user_id").eq("meetup_id", meetupId).neq("user_id", senderId),
    ]);

    const body = JSON.stringify({
      title: meetup?.title ? `🤝 ${meetup.title}` : "🤝 깐부톡",
      body: `${sender?.nickname ?? "깐부"}: ${content}`,
      meetupId,
    });

    const sent = await sendToSubscribers(supabase, (participants ?? []).map((p) => p.user_id), body);
    return NextResponse.json({ ok: true, sent });
  }

  if (payload.table === "direct_messages") {
    const { sender_id: senderId, receiver_id: receiverId, content } = payload.record;

    const { data: sender } = await supabase.from("profiles").select("nickname").eq("id", senderId).single();

    const body = JSON.stringify({
      title: `💬 ${sender?.nickname ?? "깐부"}`,
      body: content,
      senderId,
    });

    const sent = await sendToSubscribers(supabase, [receiverId], body);
    return NextResponse.json({ ok: true, sent });
  }

  return NextResponse.json({ ok: true, skipped: true });
}
