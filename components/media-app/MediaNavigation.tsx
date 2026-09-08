"use client";

import NextLink from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, type ComponentProps } from "react";

export function mediaReviewHref(href: string, reviewing: boolean) {
  if (!reviewing || !/^\/apps\/media(?:[/?#]|$)/.test(href)) return href;
  const url = new URL(href, "http://media.local");
  url.searchParams.set("preview", "integration");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function useMediaReviewNavigation() {
  const search = useSearchParams();
  const reviewing = process.env.NODE_ENV === "development" && search.get("preview") === "integration";
  const href = useCallback((path: string) => mediaReviewHref(path, reviewing), [reviewing]);
  return { reviewing, href };
}

export function MediaLink({ href, ...props }: Omit<ComponentProps<typeof NextLink>, "href"> & { href: string }) {
  const navigation = useMediaReviewNavigation();
  return <NextLink {...props} href={navigation.href(href)} />;
}

export function useMediaRouter() {
  const router = useRouter();
  const navigation = useMediaReviewNavigation();
  return useMemo(() => ({
    ...router,
    push: (path: string) => router.push(navigation.href(path)),
    replace: (path: string) => router.replace(navigation.href(path))
  }), [router, navigation.href]);
}
