"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "./lib/supabase/client";
import { CATEGORIES, getCategory } from "./lib/categories";
import CategoryFilterSheet from "./components/CategoryFilterSheet";
import { loadKakaoMaps } from "./lib/kakao";
import { distanceKm, formatDistance } from "./lib/geo";

type SearchPlace = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

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
  const placesRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchPlace[]>([]);
  const [searchMarker, setSearchMarker] = useState<SearchPlace | null>(null);
  const searchMarkerOverlayRef = useRef<any>(null);
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
    setRetrying(true);
    setRetryFailed(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const center = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(center);
        setLocationDenied(false);
        setRetrying(false);
        if (mapRef.current) {
          mapRef.current.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
        }
      },
      () => {
        setLocationDenied(true);
        setRetrying(false);
        setRetryFailed(true);
      },
      { timeout: 5000 }
    );
  }

  function goToPlace(place: SearchPlace) {
    setSearchMarker(place);
    setActiveMeetup(null);
    setSearchResults([]);
    if (mapRef.current) {
      mapRef.current.setCenter(new window.kakao.maps.LatLng(place.lat, place.lng));
      mapRef.current.setLevel(4);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query || !mapReady || !mapRef.current) return;

    const kakao = window.kakao;
    if (!placesRef.current) {
      placesRef.current = new kakao.maps.services.Places();
    }

    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    placesRef.current.keywordSearch(query, (results: any[], status: string) => {
      setSearching(false);
      if (status === kakao.maps.services.Status.OK && results.length > 0) {
        const places: SearchPlace[] = results.slice(0, 8).map((r) => ({
          id: r.id,
          name: r.place_name,
          address: r.road_address_name || r.address_name,
          lat: Number(r.y),
          lng: Number(r.x),
        }));
        if (places.length === 1) {
          goToPlace(places[0]);
        } else {
          setSearchResults(places);
        }
      } else {
        setSearchError("검색 결과가 없어요.");
      }
    });
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

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const kakao = window.kakao;
    const map = mapRef.current;

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    meetups.forEach((m) => {
      const category = getCategory(m.category);
      const pin = document.createElement("div");
      pin.className = "kakao-marker-pin";
      pin.innerHTML = `<div class="kakao-marker-badge">${category?.icon ?? "📍"}</div><div class="kakao-marker-tail"></div>`;
      pin.addEventListener("click", () => {
        setActiveMeetup(m);
        setSearchMarker(null);
      });

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
  }, [meetups, mapReady, myLocation]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const kakao = window.kakao;

    if (searchMarkerOverlayRef.current) {
      searchMarkerOverlayRef.current.setMap(null);
      searchMarkerOverlayRef.current = null;
    }

    if (searchMarker) {
      const pin = document.createElement("div");
      pin.className = "kakao-marker-search-pin";
      pin.innerHTML = `<div class="kakao-marker-search-badge">🔍</div><div class="kakao-marker-search-tail"></div>`;
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(searchMarker.lat, searchMarker.lng),
        content: pin,
        yAnchor: 1,
      });
      overlay.setMap(mapRef.current);
      searchMarkerOverlayRef.current = overlay;
    }
  }, [searchMarker, mapReady]);

  const selectedLabel = selectedCategory ? getCategory(selectedCategory)?.label ?? "전체" : "전체";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 76px)" }}>
      <div className="map-header">
        <div className="map-header-brand">
          <Image src="/icon-192.png?v=2" alt="" width={32} height={32} style={{ borderRadius: "9px" }} />
          <span className="map-header-title">깐부</span>
        </div>
        <span className="map-header-tagline">Find your local friends</span>
      </div>

      <div className="map-search-wrap">
        <form className="map-search-bar" onSubmit={handleSearchSubmit}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (searchResults.length > 0) setSearchResults([]);
              if (searchError) setSearchError(null);
            }}
            placeholder="장소를 검색해보세요 (예: 해운대, 강남역)"
            enterKeyHint="search"
          />
          {searching && <span className="map-search-status">검색 중...</span>}
        </form>
        {searchError && <p className="map-search-error">{searchError}</p>}
        {searchResults.length > 0 && (
          <div className="map-search-results">
            {searchResults.map((place) => (
              <button key={place.id} className="map-search-result-item" onClick={() => goToPlace(place)}>
                <p className="map-search-result-name">{place.name}</p>
                <p className="map-search-result-address">{place.address}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {locationDenied && !mapError && (
        <div className="location-denied-banner">
          <div>
            <p>📍 위치 권한이 꺼져 있어서 기본 위치로 보여주고 있어요.</p>
            <p className="location-denied-hint">
              {retryFailed
                ? "여전히 차단돼 있어요. 브라우저 주소창의 자물쇠(또는 ⓘ) 아이콘 → 위치 권한을 허용으로 바꾼 뒤 새로고침 해주세요."
                : "권한을 허용으로 바꿨다면 다시 시도를 눌러보세요."}
            </p>
          </div>
          <button onClick={retryLocation} disabled={retrying}>
            {retrying ? "확인 중..." : "다시 시도"}
          </button>
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

        {searchMarker && !activeMeetup && (
          <div className="map-info-card">
            <button
              onClick={() => setSearchMarker(null)}
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
            <p style={{ fontWeight: 800, fontSize: "15px" }}>🔍 {searchMarker.name}</p>
            <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "6px" }}>📍 {searchMarker.address}</p>
            <Link
              href={`/meetup/new?locationText=${encodeURIComponent(searchMarker.name)}&lat=${searchMarker.lat}&lng=${searchMarker.lng}${
                selectedCategory ? `&category=${selectedCategory}` : ""
              }`}
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "12px" }}
            >
              📍 여기서 모임 만들기
            </Link>
          </div>
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

        {!activeMeetup && !searchMarker && !mapError && (
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
