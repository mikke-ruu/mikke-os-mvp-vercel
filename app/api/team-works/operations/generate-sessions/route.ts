// Team Works R2: 週次パターン(team_works_schedule_rules)→コマ(team_works_op_sessions)の自動生成API。
// このアプリは認証をブラウザ側のSupabaseクライアント(localStorageセッション)で完結させており、
// サーバー側にcookieセッションを持たない。そのためこのルートはクライアントが送るaccess_tokenを
// Authorizationヘッダーで受け取り、それをそのままPostgRESTへ転送するクライアントを都度作る。
// service_roleキーは使わない＝RLS(本部=owner/managerのみ生成可)がそのまま効く。

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { generateSessionsForReachableProjects } from "@/lib/team-works-operations";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
  if (!accessToken) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabaseの環境変数が設定されていません。" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let body: { projectId?: string; weeksAhead?: number } = {};
  try {
    const raw = await request.text();
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  try {
    const result = await generateSessionsForReachableProjects(supabase, {
      projectId: body.projectId,
      weeksAhead: body.weeksAhead
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "コマの生成に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
