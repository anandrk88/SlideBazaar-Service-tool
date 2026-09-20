# Marketing images

Images referenced by the homepage. Files here are served from the site root,
so `public/marketing/draft-1.png` is `/marketing/draft-1.png` in code.

## Before and after (top of the homepage)

The two comparison slides are drawn in markup by default. To use real
screenshots, put the files here and name them in `PAIR` at the top of
`src/components/marketing/BeforeAfter.tsx`:

    const PAIR = {
      before: { src: "/marketing/before.png", caption: "..." },
      after: { src: "/marketing/after.png", caption: "..." },
    };

Update the caption next to each `src`. The captions that ship describe the
drawn mock-ups, so they will be wrong once a real image replaces one.

The section says the images are "drawn for this page, not customer work". That
sentence disappears on its own as soon as either `src` is set, because it would
no longer be true. If you use real client slides, make sure you have permission
to publish them.

Use landscape images; they are cropped to 16:9 and shown up to about half the
content width, so roughly 1280x720 keeps them sharp.

## Draft previews (How it works section)

The order-page illustration shows two slide thumbnails. They are drawn in
markup by default. To use real screenshots, put the files here and name them
in `DRAFT_PREVIEWS` at the top of `src/components/marketing/HowItWorks.tsx`:

    const DRAFT_PREVIEWS: { src: string | null; chart: boolean }[] = [
      { src: "/marketing/draft-1.png", chart: false },
      { src: "/marketing/draft-2.png", chart: true },
    ];

Either entry can stay `null` to keep the drawn placeholder for that slot.

Use landscape images; they are cropped to 16:9 and displayed around 220px wide,
so roughly 640x360 or larger is plenty. A "Preview" watermark is drawn over the
top, matching what customers see before they approve an order.

## Order form (How it works section)

A real screenshot of the order wizard's first screen. It is the illustration
that sits beside the five steps. Named in `WIZARD_SHOT` at the top of
`src/components/marketing/HowItWorks.tsx`; set `src` to null and the drawn
order card (`OrderCardMock` in the same file) takes its place again.

    const WIZARD_SHOT = { src: "/marketing/order-wizard.webp", width: 1353, height: 775 };

`order-wizard.webp` is 1353x775 lossless WebP, cropped from a capture of /order
so that the site header, the sticky footer bar and the development badge are all
outside the frame. Keep `width` and `height` equal to the file's real pixel size.

The shot is of the live wizard, so everything in it is a catalogue row:
treatment names, taglines, descriptions, per-slide prices and the "Most popular"
badge are all editable under Admin > Settings > Pricing & services, with no
deploy. A stale shot therefore contradicts the running app. Re-capture it
whenever the catalogue changes, or set `src` to null until you can.

To re-capture: open /order at roughly a 1900px viewport, pick a treatment, and
crop left 276, top 67, 1353x775. Set `devIndicators: false` in next.config.ts
for that session, or crop below the footer hairline as above, so the dev badge
does not ship.
