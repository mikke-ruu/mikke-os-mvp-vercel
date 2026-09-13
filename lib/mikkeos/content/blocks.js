export function createMikkeContentBlock(type) {
    const id = crypto.randomUUID();
    if (type === "links")
        return { id, type, title: "", links: [{ label: "", url: "" }] };
    if (type === "gallery")
        return { id, type, images: [], columns: 3 };
    if (type === "image-text")
        return { id, type, text: "", title: "", imageUrl: "", imageSide: "left" };
    if (type === "cta")
        return { id, type, title: "", text: "", buttonLabel: "詳しく見る", url: "" };
    if (type === "video")
        return { id, type, url: "" };
    if (type === "heading")
        return { id, type, level: 2, text: "" };
    if (type === "image")
        return { id, type, imageUrl: "", alt: "", caption: "" };
    if (type === "quote")
        return { id, type, text: "", attribution: "" };
    if (type === "list")
        return { id, type, items: [""] };
    if (type === "divider")
        return { id, type };
    if (type === "link")
        return { id, type, title: "", url: "" };
    return { id, type: "paragraph", text: "" };
}
