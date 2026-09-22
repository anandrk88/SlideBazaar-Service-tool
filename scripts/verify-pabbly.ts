/**
 * Proves the Pabbly payloads carry no free text.
 *
 *   npm run verify:pabbly
 *
 * The owner chose "structure only" deliberately: Pabbly receives the step, the
 * choices and a code, never the brief, the audience, the brand notes or a
 * message body. That promise is only worth anything if something checks it, and
 * the easy way to break it is for somebody to add one convenient field months
 * from now. This fails the moment that happens.
 *
 * Nothing here touches the network or the database.
 */
import "dotenv/config";
import { abandonedEvent, appNotificationEvent, orderPlacedEvent, startedEvent, testEvent } from "../src/lib/pabbly-events";
import { BLOCKER, blockerCode } from "../src/lib/wizard-blockers";

/** Distinctive strings standing in for everything a person could type. */
const SECRETS = {
  brief: "SECRET_BRIEF_we are acquiring Contoso in Q3",
  audience: "SECRET_AUDIENCE_the board",
  brandNotes: "SECRET_BRAND_use the 2024 palette",
  fontsColors: "SECRET_FONTS_Montserrat",
  extraNotes: "SECRET_EXTRA_do not touch slide 9",
  fileName: "SECRET_FILE_Project Falcon board deck v4.pptx",
  billingAddress: "SECRET_ADDR_10 Downing Street",
  slidesUrl: "https://docs.google.com/presentation/d/SECRET_DECK_ID/edit",
  messageBody: "SECRET_MESSAGE_can you rush this please",
};

let failures = 0;
const fail = (what: string) => {
  console.error(`  FAIL  ${what}`);
  failures += 1;
};
const pass = (what: string) => console.log(`  ok    ${what}`);

function assertClean(name: string, payload: unknown) {
  const json = JSON.stringify(payload);
  const found = Object.entries(SECRETS).filter(([, v]) => json.includes(v.slice(0, 18)));
  if (found.length) fail(`${name} leaked: ${found.map(([k]) => k).join(", ")}`);
  else pass(`${name} carries no typed text`);
  // A raw validation sentence would mean the blocker string was forwarded.
  if (/Please (write|upload|choose|select|paste|tell)/.test(json)) fail(`${name} contains a raw blocker sentence`);
}

const now = new Date("2026-09-22T10:00:00Z");

console.log("\nwizard.abandoned");
assertClean(
  "abandoned",
  abandonedEvent(
    {
      attemptId: "11111111-1111-4111-8111-111111111111",
      visitorId: "22222222-2222-4222-8222-222222222222",
      userId: null,
      createdAt: new Date("2026-09-22T09:00:00Z"),
      lastSeenAt: new Date("2026-09-22T09:20:00Z"),
      step: 4,
      maxStep: 4,
      // The worst case: a server error that embedded an uploaded file's name.
      blocker: `Step 5: File type .key is not accepted: ${SECRETS.fileName}`,
      blockedCount: 2,
      submitCount: 1,
      lastField: "brief",
      signedIn: false,
      reloads: 1,
      resumed: false,
      openedExtras: true,
      stepSeconds: "1:14,4:340",
      treatment: "REDESIGN",
      style: "CORPORATE",
      slideCount: 40,
      deliveryTier: "STANDARD",
      proofreading: "NONE",
      grammar: "UK",
      useGoogleSlides: true,
      estimateCents: 124000,
      fileCount: 1,
      fileMb: 12,
      styleFileCount: 0,
      detectedSlides: 38,
      billingFilled: "address,city",
      googleSlidesFilled: true,
      outcome: "OPEN",
    },
    now.getTime(),
  ),
);

console.log("\nwizard.started");
assertClean("started", startedEvent("33333333-3333-4333-8333-333333333333", null, false, false, now));

console.log("\norder.placed");
assertClean(
  "order.placed",
  orderPlacedEvent({
    id: "ord_1",
    orderNumber: "SB-1043",
    treatment: "REDESIGN",
    style: "CORPORATE",
    slideCount: 40,
    deliveryTier: "STANDARD",
    totalCents: 124000,
    deadlineAt: now,
    createdAt: now,
    // A customer who placed an order, so their own contact details are expected
    // and are not in SECRETS.
    customerEmail: "buyer@example.com",
    customerName: "A Buyer",
  }),
);

console.log("\napp.notification");
assertClean(
  "app.notification",
  appNotificationEvent({ type: "MESSAGE", title: "New message on SB-1043", href: "/admin/orders/ord_1", bodyChars: SECRETS.messageBody.length, recipients: 2, audiences: ["staff"], at: now, key: "n1" }),
);

console.log("\ntest");
assertClean("test", testEvent("Anand", now));

console.log("\nblockerCode");
for (const [code, msg] of Object.entries(BLOCKER)) {
  const got = blockerCode(`Step 4: ${msg}`);
  if (got === `STEP4_${code}`) pass(`${code} -> ${got}`);
  else fail(`${code} mapped to ${got}`);
}
const dirty = blockerCode(`Step 5: File type .key is not accepted: ${SECRETS.fileName}`);
if (dirty === "STEP5_OTHER") pass(`a server message with a file name collapses to ${dirty}`);
else fail(`a server message with a file name became ${dirty}`);
if (blockerCode(null) === null) pass("no blocker stays null");
else fail("null blocker did not stay null");

console.log(failures === 0 ? "\nAll payload checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
process.exitCode = failures === 0 ? 0 : 1;
