import { fetchMediaBlobUrl } from "./api";
import type { Settings } from "./types";

const blobCache = new Map<string, string>();

function sanitize(document: Document): void {
  document.querySelectorAll("script, iframe, object, embed").forEach((node) => node.remove());
  document.querySelectorAll("*").forEach((node) => {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on") || value.startsWith("javascript:")) {
        node.removeAttribute(attr.name);
      }
    }
  });
}

function mediaFilename(src: string): string | null {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) {
    return null;
  }
  if (/^https?:\/\//i.test(src)) {
    const url = new URL(src);
    const marker = "/media/";
    const index = url.pathname.indexOf(marker);
    return index >= 0 ? decodeURIComponent(url.pathname.slice(index + marker.length)) : null;
  }
  return src.replace(/^\.?\//, "");
}

export async function renderCardHtml(
  settings: Settings,
  html: string,
  signal: AbortSignal,
): Promise<string> {
  const parser = new DOMParser();
  const document = parser.parseFromString(`<main>${html}</main>`, "text/html");

  const images = Array.from(document.querySelectorAll("img"));
  await Promise.all(
    images.map(async (image) => {
      const filename = mediaFilename(image.getAttribute("src") || "");
      if (!filename) {
        return;
      }
      const cacheKey = `${settings.apiUrl}|${settings.token}|${filename}`;
      let objectUrl = blobCache.get(cacheKey);
      if (!objectUrl) {
        objectUrl = await fetchMediaBlobUrl(settings, filename, signal);
        blobCache.set(cacheKey, objectUrl);
      }
      image.setAttribute("src", objectUrl);
    }),
  );

  sanitize(document);
  return document.querySelector("main")?.innerHTML || "";
}
