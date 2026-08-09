"use client";

import jsQR from "jsqr";
import { Camera, Check, ImagePlus, Keyboard, X } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { getPublishedStoryProfile } from "@/lib/mikkeos/story-profile-db";
import { getStoryCollectionState, saveStoryToCollection } from "@/lib/mikkeos/story-collection-db";
import { normalizeStoryHandle, type StoryProfileView } from "@/lib/mikkeos/story-profile-store";
import { supabase } from "@/lib/supabase/client";

type AddMode = "closed" | "camera" | "input";

export function StoryCollectionAdd({ onSaved }: { onSaved: () => void }) {
  const [mode, setMode] = useState<AddMode>("closed");
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<StoryProfileView | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (mode !== "camera") return;
    let stream: MediaStream | null = null;
    let frameId = 0;
    let stopped = false;

    const stop = () => {
      stopped = true;
      if (frameId) cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((track) => track.stop());
    };

    const scanFrame = () => {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (width && height) {
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context?.drawImage(video, 0, 0, width, height);
          const image = context?.getImageData(0, 0, width, height);
          const result = image ? jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" }) : null;
          if (result?.data) {
            stop();
            void inspectTarget(result.data, true);
            return;
          }
        }
      }
      frameId = requestAnimationFrame(scanFrame);
    };

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((nextStream) => {
        if (stopped) {
          nextStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = nextStream;
        if (videoRef.current) {
          videoRef.current.srcObject = nextStream;
          void videoRef.current.play().then(() => {
            frameId = requestAnimationFrame(scanFrame);
          });
        }
      })
      .catch(() => {
        setMessage("カメラを開けませんでした。カメラの利用を許可するか、QR画像から追加してください。");
        setMode("input");
      });

    return stop;
  }, [mode]);

  async function inspectTarget(value: string, addAfterLookup = false) {
    const handle = parseStoryHandle(value);
    if (!handle) {
      setPreview(null);
      setMessage("mikkeOSのSTORY用QR、mikke ID、またはSTORYのURLを入力してください。");
      setMode("input");
      return;
    }

    setBusy(true);
    setMessage("");
    setInput(`@${handle}`);
    try {
      const story = await getPublishedStoryProfile(supabase, handle);
      if (!story) {
        setPreview(null);
        setMessage("公開中のSTORYが見つかりませんでした。mikke IDを確認してください。");
      } else {
        setPreview(story);
        setMode("input");
        if (addAfterLookup) await save(story);
      }
    } catch {
      setPreview(null);
      setMessage("STORYを確認できませんでした。通信状態を確認して、もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  async function save(story = preview) {
    if (!story) return;
    setBusy(true);
    setMessage("");
    try {
      const state = await getStoryCollectionState(supabase, story.handle);
      if (state.isOwnStory) {
        setMessage("自分のSTORYはコレクションへ追加する必要がありません。");
        return;
      }
      if (state.isSaved) {
        setMessage(`${story.displayName}さんのSTORYは、すでにコレクションに入っています。`);
        onSaved();
        return;
      }
      await saveStoryToCollection(supabase, story.handle);
      setMessage(`${story.displayName}さんのSTORYをコレクションに保存しました。`);
      setPreview(null);
      setInput("");
      onSaved();
    } catch {
      setMessage("コレクションに保存できませんでした。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  async function readImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context?.drawImage(bitmap, 0, 0);
      bitmap.close();
      const image = context?.getImageData(0, 0, canvas.width, canvas.height);
      const result = image ? jsQR(image.data, image.width, image.height) : null;
      if (!result?.data) {
        setMessage("画像からQRを読み取れませんでした。QRが大きく写った画像でお試しください。");
        return;
      }
      await inspectTarget(result.data, true);
    } catch {
      setMessage("画像を読み込めませんでした。別の画像でお試しください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5 rounded-xl border border-[var(--mikke-line)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">STORYをコレクションに追加</p>
          <p className="mt-1 text-xs font-normal leading-5 text-[var(--mikke-muted)]">QR、保存したQR画像、mikke IDのどれからでも追加できます。</p>
        </div>
        {mode !== "closed" ? (
          <button type="button" onClick={() => { setMode("closed"); setPreview(null); setMessage(""); }} aria-label="追加画面を閉じる" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--mikke-line)]">
            <X size={16} />
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={() => { setMessage(""); setMode("camera"); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--mikke-blue)] px-3 py-3 text-sm font-medium text-white">
          <Camera size={17} />QRを読み取る
        </button>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--mikke-line)] px-3 py-3 text-sm font-medium">
          <ImagePlus size={17} />QR画像から追加
          <input type="file" accept="image/*" onChange={(event) => void readImage(event)} className="sr-only" />
        </label>
        <button type="button" onClick={() => { setMessage(""); setMode("input"); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--mikke-line)] px-3 py-3 text-sm font-medium">
          <Keyboard size={17} />mikke IDで追加
        </button>
      </div>

      {mode === "camera" ? (
        <div className="mt-4 overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} muted playsInline className="aspect-square w-full object-cover" aria-label="QR読み取りカメラ" />
          <p className="bg-black px-4 py-3 text-center text-xs text-white">QRコードを枠内に映してください</p>
        </div>
      ) : null}

      {mode === "input" ? (
        <form className="mt-4" onSubmit={(event) => { event.preventDefault(); void inspectTarget(input, true); }}>
          <label className="block text-xs font-medium text-[var(--mikke-muted)]" htmlFor="story-collection-id">mikke ID または STORYのURL</label>
          <div className="mt-2 flex gap-2">
            <input id="story-collection-id" value={input} onChange={(event) => { setInput(event.target.value); setPreview(null); setMessage(""); }} placeholder="@ayumi" autoCapitalize="none" autoCorrect="off" className="min-w-0 flex-1 rounded-xl border border-[var(--mikke-line)] px-4 py-3 text-base outline-none focus:border-[var(--mikke-blue)]" />
            <button type="submit" disabled={busy || !input.trim()} className="rounded-xl bg-[var(--mikke-blue)] px-4 py-3 text-sm font-medium text-white disabled:opacity-50">追加する</button>
          </div>
        </form>
      ) : null}

      {preview ? (
        <div className="mt-4 rounded-xl bg-[var(--story-soft)] p-4">
          <p className="text-xs text-[var(--mikke-muted)]">STORYを確認しました</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-white text-sm font-medium">
              {preview.avatarUrl ? <img src={preview.avatarUrl} alt="" className="h-full w-full object-cover" /> : preview.displayName.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{preview.displayName}</p>
              <p className="truncate text-xs text-[var(--mikke-muted)]">@{preview.handle}</p>
            </div>
            <button type="button" disabled={busy} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--story-accent)] px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
              <Check size={16} />保存
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-4 rounded-xl bg-[var(--mikke-primary-soft)] px-4 py-3 text-xs leading-5 text-[var(--mikke-primary)]" aria-live="polite">{message}</p> : null}
      {busy && !message ? <p className="mt-3 text-center text-xs text-[var(--mikke-muted)]">確認中…</p> : null}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </div>
  );
}

export function parseStoryHandle(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const allowedHosts = new Set(["mikke-os.com", "www.mikke-os.com", "app.mikke-os.com"]);
      if (!allowedHosts.has(url.hostname.toLowerCase())) return "";
      const match = url.pathname.match(/^\/story\/([^/]+)\/?$/i);
      return match ? normalizeStoryHandle(match[1]) : "";
    } catch {
      return "";
    }
  }
  return normalizeStoryHandle(trimmed);
}
