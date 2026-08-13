"use client";

import { useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";
import DefaultAvatar from "./DefaultAvatar";

type Props = {
  userId: string;
  avatarUrl: string | null;
  onChange: (url: string | null) => void;
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export default function AvatarUploader({ userId, avatarUrl, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드할 수 있어요.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("5MB 이하 이미지로 올려주세요.");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setUploading(true);

    const supabase = createClient();
    const path = `${userId}/avatar`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setError("업로드에 실패했어요. Supabase Storage에 avatars 버킷이 있는지 확인해주세요.");
      setUploading(false);
      setPreview(null);
      URL.revokeObjectURL(localPreview);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const versionedUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

    await supabase.from("profiles").update({ avatar: versionedUrl }).eq("id", userId);

    setUploading(false);
    setPreview(null);
    URL.revokeObjectURL(localPreview);
    onChange(versionedUrl);
  }

  async function handleRemove() {
    setError(null);
    setUploading(true);
    const supabase = createClient();

    await supabase.storage.from("avatars").remove([`${userId}/avatar`]);
    await supabase.from("profiles").update({ avatar: null }).eq("id", userId);

    setUploading(false);
    onChange(null);
  }

  const displayUrl = preview ?? avatarUrl;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
      <div className="avatar-circle" onClick={() => fileInputRef.current?.click()}>
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayUrl} alt="프로필 사진" className="avatar-image" />
        ) : (
          <DefaultAvatar />
        )}
        <span className="avatar-edit-badge">{uploading ? "⏳" : "📷"}</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          type="button"
          className="btn btn-outline"
          style={{ padding: "6px 12px", fontSize: "12px" }}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          사진 변경
        </button>
        {avatarUrl && (
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: "6px 12px", fontSize: "12px" }}
            onClick={handleRemove}
            disabled={uploading}
          >
            삭제
          </button>
        )}
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: "12px" }}>{error}</p>}
    </div>
  );
}
