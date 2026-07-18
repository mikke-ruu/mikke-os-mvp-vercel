import type { PageStoreState } from "./types";

const now = "2026-07-18T00:00:00.000Z";

export const pageDemoState: PageStoreState = {
  version: 1,
  sites: [
    {
      id: "page_site_sample_group",
      ownerProfileId: "profile-ayumi",
      name: "サンプル団体",
      description: "活動紹介と問い合わせ導線をまとめる、業種に依存しないPageのデモです。",
      status: "draft",
      publication: {
        slug: "sample-group",
        isPublic: false,
        searchIndexEnabled: false
      },
      documents: [
        {
          id: "page_doc_sample_home",
          siteId: "page_site_sample_group",
          title: "ホーム",
          slug: "home",
          status: "draft",
          createdAt: now,
          updatedAt: now,
          blocks: [
            {
              id: "page_block_sample_home_heading",
              type: "heading",
              order: 1,
              level: 1,
              text: "サンプル団体のホーム"
            },
            {
              id: "page_block_sample_home_intro",
              type: "text",
              order: 2,
              text: "日々の活動、提供しているサービス、お知らせをひとつのページにまとめるための下書きです。"
            },
            {
              id: "page_block_sample_home_image",
              type: "image",
              order: 3,
              imageUrl: "/window.svg",
              alt: "サンプル画像",
              caption: "PG-0では画像URLの枠だけを確認します。"
            },
            {
              id: "page_block_sample_home_button",
              type: "button",
              order: 4,
              label: "お問い合わせの準備",
              href: "#contact"
            }
          ]
        },
        {
          id: "page_doc_sample_about",
          siteId: "page_site_sample_group",
          title: "会社概要",
          slug: "about",
          status: "draft",
          createdAt: now,
          updatedAt: now,
          blocks: [
            {
              id: "page_block_sample_about_heading",
              type: "heading",
              order: 1,
              level: 2,
              text: "私たちについて"
            },
            {
              id: "page_block_sample_about_text",
              type: "text",
              order: 2,
              text: "このPageは、特定業種のノウハウを内蔵しない汎用デモです。"
            },
            {
              id: "page_block_sample_about_divider",
              type: "divider",
              order: 3
            }
          ]
        }
      ],
      createdAt: now,
      updatedAt: now
    }
  ]
};
