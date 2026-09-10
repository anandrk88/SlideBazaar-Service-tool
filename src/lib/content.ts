/**
 * Editable homepage copy.
 *
 * Every string a visitor reads on the homepage lives here with a default. An
 * admin can override any of them under Admin > Homepage text, which writes to
 * the Setting table; the defaults below are what shows until they do, and what
 * "Reset" puts back.
 *
 * Deliberately a flat key/value map rather than a rich CMS. The homepage has a
 * fixed shape — sections, steps, cards, questions — and what changes is the
 * wording, not the structure. Keeping it flat means the admin form is a list of
 * labelled boxes, and a missing or malformed override can never break layout.
 */

export interface ContentField {
  /** Stable id. Never rename one in place: an override keyed to the old name would be orphaned. */
  key: string;
  /** Shown above the box in the admin form. */
  label: string;
  /** What renders when nobody has overridden it. */
  value: string;
  /** Render a textarea rather than a single-line input. */
  multiline?: boolean;
  /** Optional note under the field, for anything non-obvious. */
  help?: string;
}

export interface ContentGroup {
  id: string;
  title: string;
  description: string;
  fields: ContentField[];
}

export const CONTENT_GROUPS: ContentGroup[] = [
  {
    id: "hero",
    title: "Hero",
    description: "The first thing a visitor sees, at the top of the page.",
    fields: [
      { key: "hero.eyebrow", label: "Small label above the headline", value: "Custom design services" },
      { key: "hero.title", label: "Headline, first line", value: "Professional presentation design," },
      { key: "hero.titleAccent", label: "Headline, second line", value: "without the agency wait.", help: "Rendered in the italic serif accent style." },
      {
        key: "hero.intro",
        label: "Introduction",
        multiline: true,
        value:
          "Send us the deck you have, or the notes you have not turned into one yet. Our designers rebuild it, our quality team checks it, and you only pay once you are happy.",
      },
      {
        key: "hero.pointPriceFallback",
        label: "Price bullet, when no price is available",
        value: "Priced per slide, no minimum order",
        help: "Normally the bullet shows the real cheapest price from your catalogue. This is the fallback.",
      },
      {
        key: "hero.pointSpeedFallback",
        label: "Speed bullet, when no delivery tier is available",
        value: "First draft in a few business days",
      },
      { key: "hero.pointQuality", label: "Third bullet", value: "Every draft checked by our quality team" },
      { key: "hero.pointGuarantee", label: "Fourth bullet", value: "Approve before we are paid, or get a full refund" },
      { key: "hero.ctaPrimary", label: "Main button", value: "Start your order" },
      { key: "hero.ctaSecondary", label: "Secondary button", value: "See how it works" },
      { key: "hero.footnote", label: "Small print under the buttons", multiline: true, value: "No account needed to get a price. You can see the full estimate before you pay." },
    ],
  },
  {
    id: "beforeafter",
    title: "Before and after examples",
    description: "The side-by-side pair of example slides and the two reassurance lines beneath them.",
    fields: [
      { key: "beforeafter.eyebrow", label: "Small label above the heading", value: "Before and after" },
      { key: "beforeafter.title", label: "Heading", value: "The same slide, rebuilt" },
      { key: "beforeafter.drawnDisclaimer", label: "Disclaimer shown while the examples are drawings", value: "A generic mock-up drawn for this page, not customer work.", help: "Only appears while both example slides are the drawn mock-ups. It disappears automatically once a real screenshot is put in place. A space is added after it before the sentence below." },
      { key: "beforeafter.intro", label: "Introduction under the heading", multiline: true, value: "Your own deck keeps your words, your numbers and anything you tell us to leave alone." },
      { key: "beforeafter.before.chip", label: "Label on the first example", value: "Before" },
      { key: "beforeafter.before.caption", label: "Caption under the first example", multiline: true, value: "A wall of body text with two placeholder boxes doing the work of a diagram.", help: "Describes the drawn mock-up. Update it if a real screenshot replaces that example." },
      { key: "beforeafter.before.imageAlt", label: "Description of the first example, for screen readers", value: "A slide before our designers worked on it", help: "Only used when a real screenshot is in place instead of the drawing." },
      { key: "beforeafter.after.chip", label: "Label on the second example", value: "After" },
      { key: "beforeafter.after.caption", label: "Caption under the second example", value: "One idea per slide, with a data graphic that carries the point.", help: "Describes the drawn mock-up. Update it if a real screenshot replaces that example." },
      { key: "beforeafter.after.imageAlt", label: "Description of the second example, for screen readers", value: "The same slide after our designers rebuilt it", help: "Only used when a real screenshot is in place instead of the drawing." },
      { key: "beforeafter.assurance.quality", label: "First reassurance, next to the shield icon", multiline: true, value: "A quality check happens inside SlideBazaar before any draft reaches you, and you can request changes from your order page." },
      { key: "beforeafter.assurance.payment", label: "Second reassurance, next to the padlock icon", multiline: true, value: "Previews are watermarked until you approve. We hold your payment and release it only when you do, with a full refund if you do not." },
    ],
  },
  {
    id: "howitworks",
    title: "How it works",
    description: "The numbered five-step explainer section, its illustration caption and the button underneath.",
    fields: [
      { key: "howitworks.eyebrow", label: "Small label above the heading", value: "How it works" },
      { key: "howitworks.title", label: "Section heading", value: "Five steps from your deck to finished slides" },
      { key: "howitworks.intro", label: "Introduction under the heading", multiline: true, value: "The whole order runs in one place. You see the price before you pay, the progress while we work, and the finished slides before any money is released." },
      { key: "howitworks.step1.title", label: "Step 1 title", value: "Tell us what you need" },
      { key: "howitworks.step1.body", label: "Step 1 description", multiline: true, value: "Pick the treatment, the look and the deadline in the order wizard. The estimate updates as you choose, so you see the price before you commit." },
      { key: "howitworks.step1.note", label: "Step 1 extra note", multiline: true, value: "Pick the turnaround you need. The wizard shows the exact delivery date, skipping weekends and public holidays." },
      { key: "howitworks.step2.title", label: "Step 2 title", value: "Send your deck and brief" },
      { key: "howitworks.step2.body", label: "Step 2 description", multiline: true, value: "Upload your file or share a link, then tell us what the deck is for and what must not change. Logos, wording, numbers, anything you want left alone." },
      { key: "howitworks.step2.note", label: "Step 2 extra note", value: "PowerPoint, Google Slides, Keynote, PDF, Word and images are all accepted." },
      { key: "howitworks.step3.title", label: "Step 3 title", value: "Pay and we start" },
      { key: "howitworks.step3.body", label: "Step 3 description", multiline: true, value: "You pay the estimate upfront and SlideBazaar holds it. The payment is released only when you approve the finished slides, and refunded in full if you do not." },
      { key: "howitworks.step3.note", label: "Step 3 extra note", value: "Design work begins as soon as the payment is confirmed." },
      { key: "howitworks.step4.title", label: "Step 4 title", value: "We design and quality check" },
      { key: "howitworks.step4.body", label: "Step 4 description", multiline: true, value: "A designer is assigned and works to the deadline you picked. Every draft then goes through an internal review by a quality manager before it reaches you." },
      { key: "howitworks.step4.note", label: "Step 4 extra note", value: "Nothing is sent to you until it has passed that check." },
      { key: "howitworks.step5.title", label: "Step 5 title", value: "Review and approve" },
      { key: "howitworks.step5.body", label: "Step 5 description", multiline: true, value: "You see watermarked previews of the slides. If something is not right, request changes from your order page and tell us what to fix." },
      { key: "howitworks.step5.note", label: "Step 5 extra note", multiline: true, value: "Approving unlocks the original PowerPoint file and the full quality slide images for download." },
      { key: "howitworks.figureCaption", label: "Caption under the order page picture", multiline: true, value: "An illustration of the order page. The status runs from Paid to Designing to Your review to Approved. Previews stay watermarked until you approve, and the original files unlock after that.", help: "Describes the picture beside the steps. Keep it in step with the picture, which is not editable." },
      { key: "howitworks.cta", label: "Button at the end of the section", value: "Start your order" },
      { key: "howitworks.ctaNote", label: "Reassurance next to the button", value: "No account is needed to get a price, and nothing is charged until you confirm." },
    ],
  },
  {
    id: "services",
    title: "Services",
    description: "The \\\"What we do\\\" section: the six service cards and the paragraph underneath them.",
    fields: [
      { key: "services.eyebrow", label: "Small label above the heading", value: "What we do" },
      { key: "services.title", label: "Section heading", value: "Six ways we can help with a deck" },
      { key: "services.intro", label: "Introduction under the heading", multiline: true, value: "Every job is designed by a person and checked by our quality manager before you see it. You review watermarked previews, and the files unlock once you approve." },
      { key: "services.card1.title", label: "Card 1 title", value: "Presentation design" },
      { key: "services.card1.description", label: "Card 1 description", multiline: true, value: "Our core service. Send us the deck you have, choose how much you want changed, and a designer works through it slide by slide." },
      { key: "services.card1.cta", label: "Card 1 link text", value: "Start an order", help: "Also used in the card's screen-reader label, which reads \"<title>: <link text in lower case>\"." },
      { key: "services.card2.title", label: "Card 2 title", value: "Deck clean-up and brand alignment" },
      { key: "services.card2.description", label: "Card 2 description", multiline: true, value: "We make an existing deck consistent: fonts, colours, spacing and alignment on every slide. Useful when the content is right but the deck looks like several people built it." },
      { key: "services.card2.cta", label: "Card 2 link text", value: "Start an order" },
      { key: "services.card3.title", label: "Card 3 title", value: "Build from scratch" },
      { key: "services.card3.description", label: "Card 3 description", multiline: true, value: "Send notes, a sketch, a Word document or a PDF and we turn it into a finished deck. Tell us the story you want to tell and we lay it out." },
      { key: "services.card3.cta", label: "Card 3 link text", value: "Start an order" },
      { key: "services.card4.title", label: "Card 4 title", value: "Work in your template" },
      { key: "services.card4.description", label: "Card 4 description", multiline: true, value: "Upload your own brand template and we design inside it, using your layouts, fonts and colours. If you do not have one, we can follow a deck that already matches your brand." },
      { key: "services.card4.cta", label: "Card 4 link text", value: "Start an order" },
      { key: "services.card5.title", label: "Card 5 title", value: "Large decks and rebrands" },
      { key: "services.card5.description", label: "Card 5 description", multiline: true, value: "Hundreds of slides, or several decks at once. Tell us the scope and our team will plan the work and agree a schedule with you first." },
      { key: "services.card5.cta", label: "Card 5 link text", value: "Email the team", help: "This card opens an email to support instead of the order form." },
      { key: "services.card6.title", label: "Card 6 title", value: "Something else" },
      { key: "services.card6.description", label: "Card 6 description", multiline: true, value: "Infographics, icon sets, chart makeovers and master templates for your team. Describe what you need and we will quote it." },
      { key: "services.card6.cta", label: "Card 6 link text", value: "Email the team", help: "This card opens an email to support instead of the order form." },
      { key: "services.closing.beforeEmail", label: "Closing paragraph, before the email address", multiline: true, value: "Anything not listed here can be quoted on request. Email", help: "The support email address is added straight after this, followed by a space." },
      { key: "services.closing.afterEmail", label: "Closing paragraph, between the email address and the \"order\" link", multiline: true, value: "and tell us what you have in mind. Rates for the standard treatments appear as you build an" },
      { key: "services.closing.orderLink", label: "Wording of the link to the order form", value: "order" },
      { key: "services.closing.afterOrderLink", label: "Closing paragraph, after the \"order\" link", multiline: true, value: ". SlideBazaar has been making presentation templates for over ten years, with a library of more than 50,000 templates.", help: "Follows the link with no space, so it should normally start with punctuation." },
    ],
  },
  {
    id: "guarantee",
    title: "Money-back guarantee",
    description: "The money-back guarantee band near the bottom of the homepage, above the questions.",
    fields: [
      { key: "guarantee.eyebrow", label: "Small label above the heading", value: "Your money" },
      { key: "guarantee.title", label: "Heading", value: "Your money is protected" },
      { key: "guarantee.body", label: "Main paragraph", multiline: true, value: "Your order total is charged upfront and held by SlideBazaar. No third party holds it, and we do not treat it as earned until you click Approve on your final designs. If you do not approve, or we cannot deliver what you asked for, it is refunded in full to your original payment method. This is our own money-back guarantee." },
      { key: "guarantee.bodyEstimate", label: "Second paragraph, about the \"Let us decide\" option", multiline: true, value: "Chose “Let us decide”? We hold the upper estimate and refund the difference when you approve." },
      { key: "guarantee.card1.title", label: "First card, title", value: "Held" },
      { key: "guarantee.card1.body", label: "First card, text", value: "Charged when you place the order, and held by us." },
      { key: "guarantee.card2.title", label: "Second card, title", value: "Released" },
      { key: "guarantee.card2.body", label: "Second card, text", value: "Funds move to SlideBazaar when you approve." },
      { key: "guarantee.card3.title", label: "Third card, title", value: "Refunded" },
      { key: "guarantee.card3.body", label: "Third card, text", value: "Funds return to you if the work is not accepted." },
      { key: "guarantee.card4.title", label: "Fourth card, title", value: "Audited" },
      { key: "guarantee.card4.body", label: "Fourth card, text", value: "Every movement is recorded in our internal ledger." },
      { key: "guarantee.cta", label: "Button", value: "Get an instant estimate" },
      { key: "guarantee.ctaNote", label: "Small print under the button", multiline: true, value: "The wizard prices your deck as you build it. Nothing is charged until you confirm." },
    ],
  },
  {
    id: "faq",
    title: "Questions and answers",
    description: "The three columns of questions and answers near the bottom of the page, and the line under them telling people how to get in touch.",
    fields: [
      { key: "faq.eyebrow", label: "Small label above the heading", value: "Questions" },
      { key: "faq.heading", label: "Heading", value: "Answers before you order" },
      { key: "faq.intro", label: "Introduction", multiline: true, value: "The things people ask us most, about how orders run, how your money is handled and what happens to your files." },
      { key: "faq.group1.title", label: "Group 1 title", value: "Ordering and delivery" },
      { key: "faq.group1.q1.question", label: "Group 1, question 1", value: "How much does it cost?" },
      { key: "faq.group1.q1.answer", label: "Group 1, answer 1 (first paragraph)", multiline: true, value: "Every order is priced per slide. The rate depends on the treatment you choose and how quickly you need the work back. You see the exact estimate in the order wizard before you pay anything." },
      { key: "faq.group1.q1.answerLink", label: "Group 1, answer 1: link wording", value: "Start an order", help: "The clickable words that take a visitor to the order page. Keep it short." },
      { key: "faq.group1.q1.answerAfterLink", label: "Group 1, answer 1: text after the link", multiline: true, value: "to see the rate for your deck. Nothing is charged until you confirm.", help: "This follows straight after the link, in the same sentence, so it should start in lower case." },
      { key: "faq.group1.q2.question", label: "Group 1, question 2", value: "How quickly can I get my slides?" },
      { key: "faq.group1.q2.answer", label: "Group 1, answer 2", multiline: true, value: "Pick the turnaround you need when you order. Large decks add time, and the wizard shows you the exact delivery date before you pay. Dates skip weekends and the public holidays we have set." },
      { key: "faq.group1.q3.question", label: "Group 1, question 3", value: "What files can I send?" },
      { key: "faq.group1.q3.answer", label: "Group 1, answer 3", multiline: true, value: "PowerPoint, Keynote, PDF, Word and images. You can also send a Google Slides link. If all you have is a sketch or a page of notes, send that and we will work from it." },
      { key: "faq.group1.q4.question", label: "Group 1, question 4", value: "What if I do not know which treatment I need?" },
      { key: "faq.group1.q4.answer", label: "Group 1, answer 4", multiline: true, value: "Choose “Let us decide” and we pick the right treatment once we have seen your deck. We hold the upper estimate, and refund the difference when you approve." },
      { key: "faq.group1.q5.question", label: "Group 1, question 5", value: "Can I ask for changes?" },
      { key: "faq.group1.q5.answer", label: "Group 1, answer 5", multiline: true, value: "Yes. Request a revision from your order page and add notes on what you want changed. Your designer picks up the feedback and sends a new draft for you to review." },
      { key: "faq.group2.title", label: "Group 2 title", value: "Payment and guarantee" },
      { key: "faq.group2.q1.question", label: "Group 2, question 1", value: "When am I charged?" },
      { key: "faq.group2.q1.answer", label: "Group 2, answer 1", multiline: true, value: "When you place the order. We hold your payment while the work is in progress, and it is released to us only when you approve the final slides." },
      { key: "faq.group2.q2.question", label: "Group 2, question 2", value: "What if I am not happy?" },
      { key: "faq.group2.q2.answer", label: "Group 2, answer 2", multiline: true, value: "If you do not approve, or we cannot deliver what you asked for, you get a full refund to your original payment method." },
      { key: "faq.group2.q3.question", label: "Group 2, question 3", value: "Who holds my money until I approve?" },
      { key: "faq.group2.q3.answer", label: "Group 2, answer 3", multiline: true, value: "SlideBazaar holds your payment. No third party is involved. It is released to us when you approve the slides, and refunded in full to your original payment method if you do not. This is our own money-back guarantee." },
      { key: "faq.group2.q4.question", label: "Group 2, question 4", value: "Do you store my card?" },
      { key: "faq.group2.q4.answer", label: "Group 2, answer 4", multiline: true, value: "Card details are handled by Stripe. SlideBazaar never sees your card number. You can remove a saved card from your account page whenever you want." },
      { key: "faq.group3.title", label: "Group 3 title", value: "Your files and privacy" },
      { key: "faq.group3.q1.question", label: "Group 3, question 1", value: "Who can see my deck?" },
      { key: "faq.group3.q1.answer", label: "Group 3, answer 1", multiline: true, value: "The designer working on your order, the quality manager who checks the draft, and the small SlideBazaar team who run the service. We do not share your deck outside that." },
      { key: "faq.group3.q2.question", label: "Group 3, question 2", value: "Why are the previews watermarked?" },
      { key: "faq.group3.q2.answer", label: "Group 3, answer 2", multiline: true, value: "You review watermarked images first, so you can judge the design before the files are released. Approving unlocks the original PowerPoint and the original slide images." },
      { key: "faq.group3.q3.question", label: "Group 3, question 3", value: "Can I download the original PowerPoint?" },
      { key: "faq.group3.q3.answer", label: "Group 3, answer 3", multiline: true, value: "Yes, once you have approved. You can take the slide images one at a time or download the whole set in one go, along with the PowerPoint file." },
      { key: "faq.group3.q4.question", label: "Group 3, question 4", value: "Do you sign an NDA?" },
      { key: "faq.group3.q4.answerBeforeEmail", label: "Group 3, answer 4: text before the email address", multiline: true, value: "Tell us what you need and we will talk it through before you order. Email", help: "The support email address is printed automatically right after this text." },
      { key: "faq.group3.q4.answerAfterEmail", label: "Group 3, answer 4: text after the email address", value: "with your confidentiality requirements.", help: "This continues the same sentence after the email address, so it should start in lower case." },
      { key: "faq.contactBefore", label: "Closing line, before the email address", value: "Still not answered? Email", help: "The support email address is printed automatically right after this text." },
      { key: "faq.contactAfter", label: "Closing line, after the email address", value: "and a person will reply.", help: "This continues the same sentence after the email address, so it should start in lower case." },
    ],
  },
];

/** Flat lookup of every default, built from the groups. */
export const CONTENT_DEFAULTS: Record<string, string> = Object.fromEntries(
  CONTENT_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f.value])),
);

export const CONTENT_FIELDS: ContentField[] = CONTENT_GROUPS.flatMap((g) => g.fields);

/** Setting rows for copy are namespaced so they cannot collide with other settings. */
export const CONTENT_SETTING_PREFIX = "content.";

/**
 * Reads a piece of copy. Falls back to the default, then to the key itself, so
 * a typo shows up as a visible key rather than an empty gap in the page.
 */
export type Content = (key: string) => string;

export function contentGetter(overrides: Record<string, string>): Content {
  return (key) => {
    const override = overrides[key];
    if (typeof override === "string" && override.trim().length > 0) return override;
    return CONTENT_DEFAULTS[key] ?? key;
  };
}

/** A getter backed only by the defaults. Used where there is no database. */
export const defaultContent: Content = contentGetter({});
