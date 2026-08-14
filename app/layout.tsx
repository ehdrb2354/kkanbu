import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "./components/Nav";
import RegisterServiceWorker from "./register-sw";
import { NotificationProvider } from "./lib/notifications";

export const metadata: Metadata = {
  title: "깐부 — 너 내 깐부 해라!",
  description:
    "혼자 하기 애매한 취미를 같이 할 진짜 내 편을 지금 이 시간, 이 장소에서 지도로 바로 찾아주는 매칭 앱",
  icons: {
    icon: "/icon-192.png?v=2",
    apple: "/apple-touch-icon.png?v=2",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "깐부",
  },
};

export const viewport: Viewport = {
  themeColor: "#8bae1d",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css"
        />
      </head>
      <body>
        <RegisterServiceWorker />
        <NotificationProvider>
          <Nav />
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}
