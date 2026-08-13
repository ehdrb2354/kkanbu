"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { CATEGORIES, getCategory } from "../../lib/categories";
import { loadKakaoMaps } from "../../lib/kakao";
import { isSuspended, formatSuspensionRemaining } from "../../lib/suspension";

const DEFAULT_CENTER = { lat: 35.1796, lng: 129.0756 };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDatetimeLocalValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

type QuickTimePreset = "1h" | "tonight" | "tomorrow-morning";

function computeQuickTime(preset: QuickTimePreset): Date {
  const now = new Date();
  const target = new Date(now);

  if (preset === "1h") {
    target.setHours(target.getHours() + 1);
  } else if (preset === "tonight") {
    target.setHours(19, 0, 0, 0);
    if (target.getTime() < now.getTime()) target.setDate(target.getDate() + 1);
  } else {
    target.setDate(target.getDate() + 1);
    target.setHours(10, 0, 0, 0);
  }

  return target;
}

function NewMeetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") ?? CATEGORIES[0].key;

  const [categoryKey, setCategoryKey] = useState(initialCategory);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationText, setLocationText] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapPickerError, setMapPickerError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suspendedUntil, setSuspendedUntil] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("suspended_until")
        .eq("id", data.user.id)
        .single();
      setSuspendedUntil(profile?.suspended_until ?? null);
    });
  }, []);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    loadKakaoMaps()
      .then(() => {
        if (cancelled || !mapContainerRef.current) return;
        const kakao = window.kakao;

        const proceed = (center: { lat: number; lng: number }) => {
          if (cancelled || !mapContainerRef.current) return;
          const map = new kakao.maps.Map(mapContainerRef.current, {
            center: new kakao.maps.LatLng(center.lat, center.lng),
            level: 4,
          });
          mapRef.current = map;

          kakao.maps.event.addListener(map, "click", (e: any) => {
            const lat = e.latLng.getLat();
            const lng = e.latLng.getLng();
            setPickedLocation({ lat, lng });

            if (markerRef.current) {
              markerRef.current.setPosition(e.latLng);
            } else {
              markerRef.current = new kakao.maps.Marker({ position: e.latLng, map });
            }
          });
        };

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => proceed({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => proceed(DEFAULT_CENTER),
            { timeout: 5000 }
          );
        } else {
          proceed(DEFAULT_CENTER);
        }
      })
      .catch((err) => setMapPickerError(err instanceof Error ? err.message : "지도를 불러오지 못했어요."));

    return () => {
      cancelled = true;
    };
  }, []);

  function handleRecenter() {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const kakao = window.kakao;
      mapRef.current.setCenter(new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude));
    });
  }

  function handleQuickTime(preset: QuickTimePreset) {
    setScheduledAt(toDatetimeLocalValue(computeQuickTime(preset)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const category = getCategory(categoryKey);
    if (!category) {
      setError("카테고리를 선택해주세요.");
      return;
    }
    if (!locationText.trim()) {
      setError("장소 이름을 입력해주세요.");
      return;
    }
    if (!pickedLocation) {
      setError("지도를 탭해서 정확한 위치를 표시해주세요.");
      return;
    }
    if (!scheduledAt) {
      setError("날짜와 시간을 선택해주세요.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setError("로그인이 필요해요.");
      setLoading(false);
      return;
    }

    const finalTitle = title.trim() || `${category.label} 같이 하실 분 구해요`;

    const { data: meetup, error: insertError } = await supabase
      .from("meetups")
      .insert({
        category: categoryKey,
        title: finalTitle,
        description: description.trim(),
        location_text: locationText.trim(),
        location_lat: pickedLocation.lat,
        location_lng: pickedLocation.lng,
        scheduled_at: new Date(scheduledAt).toISOString(),
        capacity,
        host_id: user.id,
      })
      .select()
      .single();

    if (insertError || !meetup) {
      setError(insertError?.message ?? "매칭 생성에 실패했어요.");
      setLoading(false);
      return;
    }

    await supabase.from("meetup_participants").insert({ meetup_id: meetup.id, user_id: user.id });

    router.push(`/meetup/${meetup.id}`);
  }

  if (isSuspended(suspendedUntil)) {
    return (
      <main className="container" style={{ paddingTop: "40px" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ fontSize: "32px" }}>🚫</p>
          <p style={{ fontWeight: 800, marginTop: "8px" }}>지금은 모임을 만들 수 없어요</p>
          <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "8px" }}>
            신고 접수에 따른 제재로 활동이 잠시 제한됐어요.
            <br />
            {formatSuspensionRemaining(suspendedUntil as string)} 후에 다시 이용할 수 있어요.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container" style={{ paddingTop: "24px" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "16px" }}>새 번개모임 만들기</h1>

      <form onSubmit={handleSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div>
          <label className="field-label">카테고리</label>
          <select className="field-select" value={categoryKey} onChange={(e) => setCategoryKey(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">제목 (선택)</label>
          <input
            className="field-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 금정산 정상까지 같이 가요"
            maxLength={40}
          />
        </div>

        <div>
          <label className="field-label">소개 글 (선택)</label>
          <textarea
            className="field-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="예: 초보자도 편하게 오세요! 왕복 3시간 정도 예상해요."
            maxLength={200}
            rows={3}
            style={{ resize: "none" }}
          />
        </div>

        <div>
          <p className="form-section-title">📍 어디서 만날까요?</p>
          <input
            className="field-input"
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            placeholder="예: 금정산 범어사 매표소"
            required
            style={{ marginBottom: "10px" }}
          />

          {mapPickerError ? (
            <p style={{ color: "var(--danger)", fontSize: "13px" }}>{mapPickerError}</p>
          ) : (
            <div className="map-picker">
              {!pickedLocation && (
                <div className="map-picker-hint">🗺️ 지도를 탭해서 정확한 위치를 표시해주세요</div>
              )}
              {pickedLocation && <div className="map-picker-confirm">✅ 위치가 지정됐어요</div>}
              <button type="button" className="map-picker-recenter" onClick={handleRecenter}>
                📍 내 위치
              </button>
              <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
            </div>
          )}
        </div>

        <div>
          <p className="form-section-title">🕐 언제 모일까요?</p>
          <div className="quick-time-row">
            <button type="button" className="quick-time-chip" onClick={() => handleQuickTime("1h")}>
              ⚡ 1시간 후
            </button>
            <button type="button" className="quick-time-chip" onClick={() => handleQuickTime("tonight")}>
              🌆 오늘 저녁 7시
            </button>
            <button type="button" className="quick-time-chip" onClick={() => handleQuickTime("tomorrow-morning")}>
              🌤️ 내일 오전 10시
            </button>
          </div>
          <input
            className="field-input"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="field-label">모집 인원 (본인 포함)</label>
          <select className="field-select" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}명
              </option>
            ))}
          </select>
        </div>

        {error && <p style={{ color: "var(--danger)", fontSize: "13px" }}>{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "만드는 중..." : "번개모임 만들기"}
        </button>
      </form>
    </main>
  );
}

export default function NewMeetupPage() {
  return (
    <Suspense>
      <NewMeetupForm />
    </Suspense>
  );
}
