import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ALLOWED_TAGS, BLOCKS } from "@/lib/blocks";
import { loadBlocks } from "@/lib/blocks-server";
import { loadBlockSources } from "@/lib/blocks-source";
import { HtmlBlock } from "@/components/marketing/HtmlBlock";
import { clearBlockAction, saveBlockAction } from "./actions";

export const metadata = { title: "Homepage | SlideBazaar Admin" };
export const dynamic = "force-dynamic";

export default async function HomepageBlocksPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  await requireAdmin();
  const { msg, error } = await searchParams;
  const blocks = await loadBlocks();

  // What each section actually renders today, read from the live homepage.
  const sources = await loadBlockSources();

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Website</p>
        <h1 className="mt-1 text-2xl font-bold">Homepage</h1>
        <p className="max-w-3xl text-sm text-muted">
          Each section below can be replaced with your own HTML. A section you have not written stays as the designed version, so you can change one part of the page and leave the rest alone. Changes
          appear on the site as soon as you save, with no deploy.{" "}
          <Link href="/" target="_blank" rel="noreferrer" className="font-medium text-accent-700 underline underline-offset-2">
            Open the homepage
          </Link>
        </p>
        {msg && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</p>}
        {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      </div>

      <details className="card p-5" open={!Object.keys(blocks).length}>
        <summary className="cursor-pointer font-semibold">What you can write</summary>
        <div className="mt-3 space-y-3 text-sm text-muted">
          <p>
            Write ordinary HTML. Headings, paragraphs, lists and links are styled to match the site automatically, so you do not need to add classes to make it look right. Start from the example in a
            box below.
          </p>
          <p>
            <strong className="text-ink">Allowed tags:</strong> <code className="text-xs">{ALLOWED_TAGS.join(", ")}</code>
          </p>
          <p>
            <strong className="text-ink">Removed on save:</strong> <code className="text-xs">script</code>, <code className="text-xs">iframe</code>, <code className="text-xs">style</code>, event
            handlers such as <code className="text-xs">onclick</code>, and <code className="text-xs">javascript:</code> links. You will be told when something was taken out.
          </p>
          <p>
            <strong className="text-ink">Tailwind classes will not work.</strong> The stylesheet is built from the app&apos;s own files, so a class that only exists here is never generated. You can use
            the site&apos;s own classes though: <code className="text-xs">btn-accent</code>, <code className="text-xs">eyebrow</code>, <code className="text-xs">card</code>,{" "}
            <code className="text-xs">chip</code>.
          </p>
        </div>
      </details>

      {BLOCKS.map((block) => {
        const current = blocks[block.id];
        const isCustom = Boolean(current);
        return (
          <section key={block.id} className="card p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">
                {block.label}
                <span className={`ml-3 chip ${isCustom ? "bg-accent-50 text-accent-700" : "bg-slate-100 text-slate-600"}`}>{isCustom ? "your HTML" : "designed version"}</span>
              </h2>
              {isCustom && (
                <form action={clearBlockAction.bind(null, block.id)}>
                  <button className="text-xs font-medium text-rose-700 hover:underline">Discard my HTML and go back to the designed version</button>
                </form>
              )}
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted">{block.description}</p>

            <form action={saveBlockAction.bind(null, block.id)} className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <label className="label" htmlFor={`html-${block.id}`}>
                  HTML
                </label>
                <textarea
                  id={`html-${block.id}`}
                  name="html"
                  defaultValue={current ?? sources[block.id] ?? block.starter}
                  spellCheck={false}
                  rows={22}
                  placeholder={block.starter}
                  className="input font-mono text-xs leading-relaxed"
                />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button className="btn-primary !px-4 !py-2 !text-sm">Save this section</button>
                  <span className="text-xs text-muted">
                    {isCustom
                      ? "Empty the box and save to go back to the designed version."
                      : "This is the section's current markup. Change it and save, and the page changes."}
                  </span>
                </div>
              </div>

              <div>
                <p className="label">Preview</p>
                <div className="max-h-[34rem] overflow-auto rounded-xl border border-slate-200 bg-white">
                  {current ? (
                    <HtmlBlock html={current} invert={block.id === "hero"} />
                  ) : (
                    <p className="p-4 text-sm text-muted">The designed version is on the site. Save a change and the result shows here.</p>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted">Shows what was saved, after cleaning. Narrower than the real page, so check the site itself for layout.</p>
              </div>
            </form>
          </section>
        );
      })}
    </div>
  );
}
