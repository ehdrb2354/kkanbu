"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, NearbyIcon, ChatIcon, ProfileIcon } from "./TabIcons";

const TABS = [
  { href: "/", label: "홈", Icon: HomeIcon },
  { href: "/nearby", label: "주변", Icon: NearbyIcon },
  { href: "/chats", label: "채팅", Icon: ChatIcon },
  { href: "/profile", label: "프로필", Icon: ProfileIcon },
];

export default function Nav() {
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/signup") return null;

  const isMeetupDetail = /^\/meetup\/[^/]+$/.test(pathname) && pathname !== "/meetup/new";
  const hasOwnHeader = pathname === "/" || pathname.startsWith("/profile") || isMeetupDetail;

  return (
    <>
      {!hasOwnHeader && (
        <header className="top-bar">
          <Link href="/" className="brand">
            <Image src="/icon-192.png" alt="" width={28} height={28} style={{ borderRadius: "8px" }} />
            <span>깐부</span>
          </Link>
        </header>
      )}

      <nav className="bottom-nav">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`bottom-nav-link ${pathname === tab.href ? "active" : ""}`}
          >
            <tab.Icon size={22} />
            <span>{tab.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
