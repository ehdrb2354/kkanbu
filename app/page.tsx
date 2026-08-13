"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "./lib/supabase/client";
import { CATEGORIES, getCategory } from "./lib/categories";
import CategoryFilterSheet from "./components/CategoryFilterSheet";
import { loadKakaoMaps } from "./lib/kakao";
import { distanceKm, formatDistance } from "./lib/geo";

type MeetupMarker = {
  id: string;
  title: string;
  category: string;
  location_text: string;
  location_lat: number;
  location_lng: number;
  scheduled_at: string;
  capacity: number;
  participantCount: number;
};

// 기본 중심 좌표: 위치 권한을 거부했을 때 사용 (부산시청)
const DEFAULT_CENTER = { lat: 35.1796, lng: 129.0756 };

export default function HomeMapPage() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [meetups, setMeetups] = useState<MeetupMarker[]>([]);
  const [activeMeetup, setActiveMeetup] = useState<MeetupMarker | null>(null);

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
            level: 5,
          });
          mapRef.current = map;
          setMapReady(true);
        };

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const center = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              proceed(center);
              setMyLocation(center);
              setLocationDenied(false);
            },
            () => {
              proceed(DEFAULT_CENTER);
              setLocationDenied(true);
            },
            { timeout: 5000 }
          );
        } else {
          proceed(DEFAULT_CENTER);
          setLocationDenied(true);
        }
      })
      .catch((err) => setMapError(err instanceof Error ? err.message : "지도를 불러오지 못했어요."));

    return () => {
      cancelled = true;
    };
  }, []);

  function retryLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const center = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(center);
        setLocationDenied(false);
        if (mapRef.current) {
          mapRef.current.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
        }
      },
      () => setLocationDenied(true),
      { timeout: 5000 }
    );
  }

  const loadMeetups = useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from("meetups")
      .select(
        "id, title, category, location_text, location_lat, location_lng, scheduled_at, capacity, meetup_participants(count)"
      )
      .eq("status", "open")
      .gte("scheduled_at", new Date().toISOString());

    if (selectedCategory) {
      query = query.eq("category", selectedCategory);
    }

    const { data } = await query;
    if (data) {
      setMeetups(
        data.map((row) => {
          const r = row as unknown as {
            id: string;
            title: string;
            category: string;
            location_text: string;
            location_lat: number;
            location_lng: number;
            scheduled_at: string;
            capacity: number;
            meetup_participants: { count: number }[];
          };
          return {
            id: r.id,
            title: r.title,
            category: r.category,
            location_text: r.location_text,
            location_lat: r.location_lat,
            location_lng: r.location_lng,
            scheduled_at: r.scheduled_at,
            capacity: r.capacity,
            participantCount: r.meetup_participants?.[0]?.count ?? 0,
          };
        })
      );
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadMeetups();
    const supabase = createClient();
    const channel = supabase
      .channel("home-map")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetups" }, loadMeetups)
      .on("postgres_changes", { event: "*", schema: "public", table: "meetup_participants" }, loadMeetups)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMeetups]);

  const visibleMeetups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return meetups;
    return meetups.filter(
      (m) => m.title.toLowerCase().includes(query) || m.location_text.toLowerCase().includes(query)
    );
  }, [meetups, searchQuery]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const kakao = window.kakao;
    const map = mapRef.current;

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    visibleMeetups.forEach((m) => {
      const category = getCategory(m.category);
      const pin = document.createElement("div");
      pin.className = "kakao-marker-pin";
      pin.innerHTML = `<div class="kakao-marker-badge">${category?.icon ?? "📍"}</div><div class="kakao-marker-tail"></div>`;
      pin.addEventListener("click", () => setActiveMeetup(m));

      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(m.location_lat, m.location_lng),
        content: pin,
        yAnchor: 1,
      });
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    });

    if (myLocation) {
      const mine = document.createElement("div");
      mine.className = "kakao-marker-mine-pin";
      mine.innerHTML = `<div class="kakao-marker-mine-badge"></div><div class="kakao-marker-mine-tail"></div>`;
      const mineOverlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(myLocation.lat, myLocation.lng),
        content: mine,
        yAnchor: 1,
      });
      mineOverlay.setMap(map);
      overlaysRef.current.push(mineOverlay);
    }
  }, [visibleMeetups, mapReady, myLocation]);

  const selectedLabel = selectedCategory ? getCategory(selectedCategory)?.label ?? "전체" : "전체";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 76px)" }}>
      <div className="map-header">
        <div className="map-header-brand">
          <Image src="/icon-192.png" alt="" width={32} height={32} style={{ borderRadius: "9px" }} />
          <span className="map-header-title">깐부</span>
        </div>
        <span className="map-header-tagline">Find your local friends</span>
      </div>

      <div className="map-search-wrap">
        <div className="map-search-bar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="동네 주변 장소를 검색해보세요"
          />
        </div>
      </div>

      {locationDenied && !mapError && (
        <div className="location-denied-banner">
          <div>
            <p>📍 위치 권한이 꺼져 있어서 기본 위치로 보여주고 있어요.</p>
            <p className="location-denied-hint">
              계속 안 되면 주소창의 자물쇠 아이콘 → 위치 권한을 허용으로 바꾼 뒤 새로고침 해주세요.
            </p>
          </div>
          <button onClick={retryLocation}>다시 시도</button>
        </div>
      )}

      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <div className="map-filter-bar">
          <button className="map-filter-button" onClick={() => setFilterOpen(true)}>
            🏷️ {selectedLabel} ▾
          </button>
        </div>

        {mapError ? (
          <div className="map-fallback">
            <div className="card" style={{ textAlign: "center", maxWidth: "320px" }}>
              <p style={{ fontWeight: 800, marginBottom: "8px" }}>지도를 불러올 수 없어요</p>
              <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: 1.6 }}>{mapError}</p>
              <p style={{ color: "var(--muted)", fontSize: "12px", marginTop: "8px" }}>
                .env.local에 카카오맵 키를 설정해주세요.
              </p>
              <Link
                href={`/category/${selectedCategory ?? CATEGORIES[0].key}`}
                className="btn btn-primary"
                style={{ marginTop: "16px", width: "100%" }}
              >
                목록으로 보기
              </Link>
            </div>
          </div>
        ) : (
          <div className="map-container" ref={mapContainerRef} />
        )}

        {activeMeetup && (
          <div className="map-info-card">
            <button
              onClick={() => setActiveMeetup(null)}
              style={{
                position: "absolute",
                top: "10px",
                right: "14px",
                background: "none",
                border: "none",
                fontSize: "16px",
                color: "var(--muted)",
              }}
            >
              ✕
            </button>
            <p style={{ fontWeight: 800, fontSize: "15px" }}>
              {getCategory(activeMeetup.category)?.icon} {activeMeetup.title}
            </p>
            <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "6px" }}>
              🕒 {formatDateTime(activeMeetup.scheduled_at)}
            </p>
            <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "2px" }}>
              👥 {activeMeetup.participantCount}/{activeMeetup.capacity}명
              {myLocation && (
                <>
                  {" "}
                  · 📍{" "}
                  {formatDistance(
                    distanceKm(myLocation.lat, myLocation.lng, activeMeetup.location_lat, activeMeetup.location_lng)
                  )}
                </>
              )}
            </p>
            <Link href={`/meetup/${activeMeetup.id}`} className="btn btn-primary" style={{ width: "100%", marginTop: "12px" }}>
              상세보기
            </Link>
          </div>
        )}

        {!activeMeetup && !mapError && (
          <Link href={`/meetup/new${selectedCategory ? `?category=${selectedCategory}` : ""}`} className="map-fab">
            +
          </Link>
        )}
      </div>

      <CategoryFilterSheet
        open={filterOpen}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
        onClose={() => setFilterOpen(false)}
      />
    </div>
  );
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
