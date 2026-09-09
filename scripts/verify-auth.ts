/**
 * Regression checks for the auth helpers that decide where a user is sent and
 * which account they land on. Run: npm run verify:auth
 */
import { normalizeEmail, safeNext } from "../src/lib/validation";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!cond) failures++;
}

const APP = "http://localhost:3000";

// --- safeNext: must never send a user to another origin -------------------
// Built with fromCharCode so a stray editor or shell escape cannot silently
// weaken the test input. BS is a single backslash.
const BS = String.fromCharCode(92);
const blocked = [
  "https://evil.com",
  "//evil.com",
  BS + BS + "evil.com",
  "/" + BS + "evil.com",
  BS + "/evil.com",
  "https:evil.com",
  "javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "http://localhost:3001/x",
  "/" + String.fromCharCode(9) + "evil",
  "/" + String.fromCharCode(10) + "evil",
  "/" + String.fromCharCode(13) + "evil",
  String.fromCharCode(0) + "/dashboard",
];
for (const b of blocked) {
  check(`rejects ${JSON.stringify(b)}`, safeNext(b, APP) === undefined, String(safeNext(b, APP)));
}

const allowed: [string, string][] = [
  ["/dashboard", "/dashboard"],
  ["/order?resume=1", "/order?resume=1"],
  ["/admin/orders/abc", "/admin/orders/abc"],
  ["http://localhost:3000/dashboard", "/dashboard"],
];
for (const [input, want] of allowed) {
  check(`allows ${input}`, safeNext(input, APP) === want, String(safeNext(input, APP)));
}
check("undefined passes through", safeNext(undefined, APP) === undefined);
check("empty string passes through", safeNext("", APP) === undefined);

// --- normalizeEmail: one canonical form, no accidental merging ------------
check("lowercases", normalizeEmail("  Anand@Example.COM ") === "anand@example.com");
check("keeps plus addressing distinct", normalizeEmail("a+b@gmail.com") === "a+b@gmail.com");
check("punycodes a unicode domain", normalizeEmail("a@exämple.com") === "a@xn--exmple-cua.com", normalizeEmail("a@exämple.com"));
check("leaves the local part alone apart from case", normalizeEmail("First.Last@x.com") === "first.last@x.com");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
