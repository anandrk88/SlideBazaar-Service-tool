import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { ChevronDownIcon, LockIcon, ShieldCheckIcon, TasksIcon } from "@/components/Icons";

const SUPPORT_EMAIL = "support@slidebazaar.com";

type FaqItem = {
  id: string;
  question: string;
  answer: ReactNode;
};

type FaqGroup = {
  id: string;
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  items: FaqItem[];
};

const GROUPS: FaqGroup[] = [
  {
    id: "faq-ordering",
    title: "Ordering and delivery",
    icon: TasksIcon,
    items: [
      {
        id: "cost",
        question: "How much does it cost?",
        answer: (
          <>
            <p>
              Every order is priced per slide. The rate depends on the treatment you choose and how quickly you need the work back. You see the exact estimate in the order wizard before you pay
              anything.
            </p>
            <p className="mt-2">
              <Link href="/order" className="font-semibold text-accent-700 underline underline-offset-2 hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 rounded">
                Start an order
              </Link>{" "}
              to see the rate for your deck. Nothing is charged until you confirm.
            </p>
          </>
        ),
      },
      {
        id: "speed",
        question: "How quickly can I get my slides?",
        answer: (
          <p>
            Pick the turnaround you need when you order. Large decks add time, and the wizard shows you the exact delivery date before you pay. Dates skip weekends and the public holidays we have
            set.
          </p>
        ),
      },
      {
        id: "files",
        question: "What files can I send?",
        answer: (
          <p>PowerPoint, Keynote, PDF, Word and images. You can also send a Google Slides link. If all you have is a sketch or a page of notes, send that and we will work from it.</p>
        ),
      },
      {
        id: "treatment",
        question: "What if I do not know which treatment I need?",
        answer: (
          <p>
            Choose &ldquo;Let us decide&rdquo; and we pick the right treatment once we have seen your deck. We hold the upper estimate, and refund the difference when you approve.
          </p>
        ),
      },
      {
        id: "revisions",
        question: "Can I ask for changes?",
        answer: (
          <p>Yes. Request a revision from your order page and add notes on what you want changed. Your designer picks up the feedback and sends a new draft for you to review.</p>
        ),
      },
    ],
  },
  {
    id: "faq-payment",
    title: "Payment and guarantee",
    icon: LockIcon,
    items: [
      {
        id: "charged",
        question: "When am I charged?",
        answer: <p>When you place the order. We hold your payment while the work is in progress, and it is released to us only when you approve the final slides.</p>,
      },
      {
        id: "not-happy",
        question: "What if I am not happy?",
        answer: <p>If you do not approve, or we cannot deliver what you asked for, you get a full refund to your original payment method.</p>,
      },
      {
        id: "holds-payment",
        question: "Who holds my money until I approve?",
        answer: (
          <p>
            SlideBazaar holds your payment. No third party is involved. It is released to us when you approve the slides, and refunded in full to your original payment method if you do not. This is
            our own money-back guarantee.
          </p>
        ),
      },
      {
        id: "card",
        question: "Do you store my card?",
        answer: <p>Card details are handled by Stripe. SlideBazaar never sees your card number. You can remove a saved card from your account page whenever you want.</p>,
      },
    ],
  },
  {
    id: "faq-privacy",
    title: "Your files and privacy",
    icon: ShieldCheckIcon,
    items: [
      {
        id: "who-sees",
        question: "Who can see my deck?",
        answer: (
          <p>
            The designer working on your order, the quality manager who checks the draft, and the small SlideBazaar team who run the service. We do not share your deck outside that.
          </p>
        ),
      },
      {
        id: "watermark",
        question: "Why are the previews watermarked?",
        answer: <p>You review watermarked images first, so you can judge the design before the files are released. Approving unlocks the original PowerPoint and the original slide images.</p>,
      },
      {
        id: "download",
        question: "Can I download the original PowerPoint?",
        answer: <p>Yes, once you have approved. You can take the slide images one at a time or download the whole set in one go, along with the PowerPoint file.</p>,
      },
      {
        id: "nda",
        question: "Do you sign an NDA?",
        answer: (
          <p>
            Tell us what you need and we will talk it through before you order. Email{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-semibold text-accent-700 underline underline-offset-2 hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 rounded"
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            with your confidentiality requirements.
          </p>
        ),
      },
    ],
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <p className="eyebrow">Questions</p>
      <h2 className="mt-2 text-2xl font-bold">Answers before you order</h2>
      <p className="mt-2 max-w-2xl text-muted">The things people ask us most, about how orders run, how your money is handled and what happens to your files.</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-3 lg:gap-8">
        {GROUPS.map((group) => {
          const GroupIcon = group.icon;
          return (
            <section key={group.id} aria-labelledby={group.id}>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-600">
                  <GroupIcon width={22} height={22} aria-hidden="true" />
                </span>
                <h3 id={group.id} className="text-base font-bold">
                  {group.title}
                </h3>
              </div>

              <div className="mt-4 space-y-3">
                {group.items.map((item) => (
                  <details key={item.id} className="group card">
                    <summary className="flex list-none cursor-pointer items-start justify-between gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                      <span>{item.question}</span>
                      <ChevronDownIcon width={20} height={20} aria-hidden="true" className="mt-0.5 shrink-0 text-accent-600 transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 text-sm leading-relaxed text-muted">{item.answer}</div>
                  </details>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-10 text-sm text-muted">
        Still not answered? Email{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="font-semibold text-accent-700 underline underline-offset-2 hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 rounded"
        >
          {SUPPORT_EMAIL}
        </a>{" "}
        and a person will reply.
      </p>
    </section>
  );
}
