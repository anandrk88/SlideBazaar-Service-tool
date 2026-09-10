/**
 * Pictures and video on the homepage.
 *
 * A fixed set of named slots, each of which an admin can fill from
 * Admin > Homepage media. An empty slot falls back to the drawing that ships
 * with the app, so the page always looks finished even before anything is
 * uploaded.
 *
 * Slots are named and fixed rather than a free media library because each one
 * has a place in the layout with its own shape and meaning. A library would let
 * somebody upload a portrait photo into a 16:9 hero and wonder why it looks
 * wrong.
 */

export type MediaKind = "image" | "video";

export interface MediaSlot {
  /** Stable id. Also the public URL segment: /api/media/<id>. */
  id: string;
  group: string;
  label: string;
  kind: MediaKind;
  /** What it is and what shape works, in plain language. */
  help: string;
  /** What renders while the slot is empty. */
  fallback: string;
}

export const MEDIA_SLOTS: MediaSlot[] = [
  {
    id: "hero.image",
    group: "Hero",
    label: "Hero picture",
    kind: "image",
    help: "Replaces the drawn slide collage on the right of the hero. Landscape, ideally 1600x1000 or larger.",
    fallback: "The drawn slide collage.",
  },
  {
    id: "hero.video",
    group: "Hero",
    label: "Hero video",
    kind: "video",
    help: "Plays muted and looping in place of the picture. MP4 works everywhere. Keep it short and small; this is decoration, not a film.",
    fallback: "The hero picture, or the drawn collage if there is none.",
  },
  {
    id: "beforeafter.before",
    group: "Before and after",
    label: "Before slide",
    kind: "image",
    help: "The untidy slide on the left. Cropped to 16:9.",
    fallback: "The drawn before mock-up.",
  },
  {
    id: "beforeafter.after",
    group: "Before and after",
    label: "After slide",
    kind: "image",
    help: "The rebuilt slide on the right. Cropped to 16:9.",
    fallback: "The drawn after mock-up.",
  },
];

export const MEDIA_SLOT_IDS = MEDIA_SLOTS.map((s) => s.id);

export function findMediaSlot(id: string): MediaSlot | undefined {
  return MEDIA_SLOTS.find((s) => s.id === id);
}

/** Setting rows for media are namespaced so they cannot collide with copy. */
export const MEDIA_SETTING_PREFIX = "media.";

/** What is stored against a slot. */
export interface MediaRecord {
  /** Object key in storage. Never sent to the browser. */
  key: string;
  contentType: string;
  sizeBytes: number;
  originalName: string;
  uploadedAt: string;
  /** Changes on every upload, so a replaced file is not served from cache. */
  version: string;
}

/**
 * Public URL for a slot. Versioned so a replacement is picked up immediately
 * even though the response is cached hard.
 */
export function mediaUrl(slot: string, version: string) {
  return `/api/media/${encodeURIComponent(slot)}?v=${encodeURIComponent(version)}`;
}

/** What an admin may upload, by slot kind. */
export const ACCEPTED_MEDIA: Record<MediaKind, { extensions: string[]; contentTypes: string[]; maxBytes: number; accept: string }> = {
  image: {
    extensions: [".png", ".jpg", ".jpeg", ".webp", ".avif"],
    contentTypes: ["image/png", "image/jpeg", "image/webp", "image/avif"],
    // Generous for a photo, small enough that a mistake is obvious.
    maxBytes: 10 * 1024 * 1024,
    accept: "image/png,image/jpeg,image/webp,image/avif",
  },
  video: {
    extensions: [".mp4", ".webm"],
    contentTypes: ["video/mp4", "video/webm"],
    maxBytes: 50 * 1024 * 1024,
    accept: "video/mp4,video/webm",
  },
};
