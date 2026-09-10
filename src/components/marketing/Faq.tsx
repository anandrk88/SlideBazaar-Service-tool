import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { ChevronDownIcon, LockIcon, ShieldCheckIcon, TasksIcon } from "@/components/Icons";
import type { Content } from "@/lib/content";

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

function faqGroups(t: Content): FaqGroup[] {
  return [
    {
      id: "faq-ordering",
      title: t("faq.group1.title"),
      icon: TasksIcon,
      items: [
        {
          id: "cost",
          question: t("faq.group1.q1.question"),
          answer: (
            <>
              <p>
                {t("faq.group1.q1.answer")}
              </p>
              <p className="mt-2">
                <Link href="/order" className="font-semibold text-accent-700 underline underline-offset-2 hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 rounded">
                  {t("faq.group1.q1.answerLink")}
                </Link>{" "}
                {t("faq.group1.q1.answerAfterLink")}
              </p>
            </>
          ),
        },
        {
          id: "speed",
          question: t("faq.group1.q2.question"),
          answer: (
            <p>
              {t("faq.group1.q2.answer")}
            </p>
          ),
        },
        {
          id: "files",
          question: t("faq.group1.q3.question"),
          answer: (
            <p>{t("faq.group1.q3.answer")}</p>
          ),
        },
        {
          id: "treatment",
          question: t("faq.group1.q4.question"),
          answer: (
            <p>
              {t("faq.group1.q4.answer")}
            </p>
          ),
        },
        {
          id: "revisions",
          question: t("faq.group1.q5.question"),
          answer: (
            <p>{t("faq.group1.q5.answer")}</p>
          ),
        },
      ],
    },
    {
      id: "faq-payment",
      title: t("faq.group2.title"),
      icon: LockIcon,
      items: [
        {
          id: "charged",
          question: t("faq.group2.q1.question"),
          answer: <p>{t("faq.group2.q1.answer")}</p>,
        },
        {
          id: "not-happy",
          question: t("faq.group2.q2.question"),
          answer: <p>{t("faq.group2.q2.answer")}</p>,
        },
        {
          id: "holds-payment",
          question: t("faq.group2.q3.question"),
          answer: (
            <p>
              {t("faq.group2.q3.answer")}
            </p>
          ),
        },
        {
          id: "card",
          question: t("faq.group2.q4.question"),
          answer: <p>{t("faq.group2.q4.answer")}</p>,
        },
      ],
    },
    {
      id: "faq-privacy",
      title: t("faq.group3.title"),
      icon: ShieldCheckIcon,
      items: [
        {
          id: "who-sees",
          question: t("faq.group3.q1.question"),
          answer: (
            <p>
              {t("faq.group3.q1.answer")}
            </p>
          ),
        },
        {
          id: "watermark",
          question: t("faq.group3.q2.question"),
          answer: <p>{t("faq.group3.q2.answer")}</p>,
        },
        {
          id: "download",
          question: t("faq.group3.q3.question"),
          answer: <p>{t("faq.group3.q3.answer")}</p>,
        },
        {
          id: "nda",
          question: t("faq.group3.q4.question"),
          answer: (
            <p>
              {t("faq.group3.q4.answerBeforeEmail")}{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-semibold text-accent-700 underline underline-offset-2 hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 rounded"
              >
                {SUPPORT_EMAIL}
              </a>{" "}
              {t("faq.group3.q4.answerAfterEmail")}
            </p>
          ),
        },
      ],
    },
  ];
}

export function Faq({ t }: { t: Content }) {
  const groups = faqGroups(t);

  return (
    <section id="faq" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <p className="eyebrow">{t("faq.eyebrow")}</p>
      <h2 className="mt-2 text-2xl font-bold">{t("faq.heading")}</h2>
      <p className="mt-2 max-w-2xl text-muted">{t("faq.intro")}</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-3 lg:gap-8">
        {groups.map((group) => {
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
        {t("faq.contactBefore")}{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="font-semibold text-accent-700 underline underline-offset-2 hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 rounded"
        >
          {SUPPORT_EMAIL}
        </a>{" "}
        {t("faq.contactAfter")}
      </p>
    </section>
  );
}
