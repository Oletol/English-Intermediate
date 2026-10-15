// Unit 1: импорт реального course.json, ответы во всех упражнениях, проверка преподавателем.
// Запуск: python3 -m http.server 5055 -d docs &  node tests/watch.e2e.mjs
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:5055", SHOTS = "/tmp/shots-u1";
mkdirSync(SHOTS, { recursive: true });
const mock = readFileSync(new URL("./mock-fb.js", import.meta.url), "utf8");
const course = readFileSync(new URL("../content-private/course.json", import.meta.url), "utf8");
const C = JSON.parse(course);
const W = C.units.find((u) => u.id === "u1");
const keyOf = (id) => W.sections.flatMap((s) => s.blocks).find((b) => b.id === id);
const first = (a) => (Array.isArray(a) ? a[0] : a);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route("**/js/fb.js", (r) => r.fulfill({ contentType: "text/javascript", body: mock }));
await ctx.route("https://api.languagetool.org/**", (r) => r.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"matches":[]}' }));
const errors = [];
const page = async (url) => { const p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(url + ": " + e.message)); p.on("dialog", (d) => d.accept()); await p.goto(BASE + url); return p; };
const step = (s) => console.log("•", s);
const sel = (ex, it) => `[data-ex="${ex}"][data-item="${it}"]`;

const t = await page("/teacher.html");
await t.evaluate(() => {
  localStorage.setItem("mock:auth", JSON.stringify({ "teacher@uni.ru": { uid: "T1", password: "secret1" } }));
  localStorage.setItem("mock:db", JSON.stringify({ "teachers/T1": { name: "Teacher" } }));
});
await t.reload();
await t.fill("#auth-form [name=email]", "teacher@uni.ru");
await t.fill("#auth-form [name=password]", "secret1");
await t.click("#auth-submit");
await t.waitForSelector("#tool-nav .sb-item");

step("Импорт course.json");
await t.click('a[href="#tools/content"]');
await t.waitForSelector("#import-text");
await t.evaluate((c) => { document.querySelector("#import-text").value = c; }, course);
await t.click("[data-act=import]");
await t.waitForSelector('#watch-nav .sb-uh[data-unit="w1"]');
const db = await t.evaluate(() => JSON.parse(localStorage.getItem("mock:db")));
const pub = JSON.stringify(db["unitContent/w1"]);
assert.ok(!pub.includes('"answer"'), "в unitContent нет ключей");
assert.ok(!pub.includes("Plot in brief"), "заметки преподавателя не попадают к студенту");
assert.equal(db["units/w1"].track, "watch");
assert.equal(await t.locator('#unit-nav .sb-uh[data-unit="w1"]').count(), 0, "фильм не в списке юнитов");
assert.equal((await t.textContent('#watch-nav .sb-uh[data-unit="w1"] .u-n')).trim(), "W1");

step("Группа и студент");
await t.click('a[href="#tools/groups"]');
await t.waitForSelector("#g-name");
await t.fill("#g-name", "Anna");
await t.fill("#g-code", "anna");
await t.click("[data-act=create-group]");
await t.waitForSelector("code:text('ANNA')");
const s = await page("/index.html");
await s.click("[data-mode=register]");
await s.fill("[name=name]", "Anna Ivanova");
await s.fill("[name=email]", "anna@mail.ru");
await s.fill("[name=password]", "pass123");
await s.fill("[name=group]", "anna");
await s.click("#auth-submit");
await s.waitForSelector("text=No units are open yet");
await t.click('a[href="#tools/access"]');
await t.click("[data-act=toggle-open][data-unit=u1]");
await s.waitForSelector('#unit-nav .sb-uh[data-unit="u1"][data-can-open="1"]', { timeout: 5000 });

step("Студент отвечает во всех автопроверяемых упражнениях (всё верно, кроме первого пункта)");
const exs = W.sections.flatMap((sec) => sec.blocks.filter((b) => b.type === "exercise" && b.kind !== "open").map((b) => ({ ...b, sec: sec.id })));
for (const ex of exs) {
  await s.goto(`${BASE}/index.html#u1/${ex.sec}`); await s.waitForSelector(`#ex-${ex.id}`);
  for (const [k, it] of ex.items.entries()) {
    const right = first(it.answer);
    if (ex.kind === "mcq") await s.check(`${sel(ex.id, it.id)}[value=${k === 0 ? (right === "A" ? "B" : "A") : right}]`);
    else if (ex.kind === "match" && ex.display !== "letters") await s.selectOption(sel(ex.id, it.id), k === 0 ? ex.options.find((o) => o.id !== right).id : right);
    else await s.fill(sel(ex.id, it.id), k === 0 ? "zzz" : right);
  }
}
await s.locator("#save-state", { hasText: /saved/i }).waitFor({ timeout: 5000 });
await s.waitForTimeout(1500);
assert.equal(await s.locator(".keyhint, .tnote").count(), 0, "у студента нет ключей и заметок");

step("Преподаватель проверяет каждое упражнение");
for (const ex of exs) {
  await t.goto(`${BASE}/teacher.html#u1/${ex.sec}`);
  await t.waitForSelector(`[data-act="check-ex"][data-ex="${ex.id}"]`);
  await t.click(`[data-act="check-ex"][data-ex="${ex.id}"]`);
  await s.goto(`${BASE}/index.html#u1/${ex.sec}`);
  await s.waitForSelector(`#ex-${ex.id} .ex-score`, { timeout: 5000 });
  const n = ex.items.length;
  assert.equal((await s.textContent(`#ex-${ex.id} .ex-score`)).trim(), `${n - 1} / ${n}`, ex.id);
}
for (const sec of ["warmup", "reading"]) {
  await s.goto(`${BASE}/index.html#u1/${sec}`); await s.waitForSelector(".ex-score");
  await s.screenshot({ path: `${SHOTS}/student-${sec}.png`, fullPage: true });
  await t.goto(`${BASE}/teacher.html#u1/${sec}`); await t.waitForSelector(".keyhint");
  await t.screenshot({ path: `${SHOTS}/teacher-${sec}.png`, fullPage: true });
  assert.equal(/[→←⤮»«▼›]/.test(await s.evaluate(() => document.body.innerText)), false, "нет стрелок");
}

step("Мобильная ширина");
await s.setViewportSize({ width: 390, height: 844 });
await s.waitForTimeout(500);
for (const sec of ["warmup", "reading"]) {
  await s.goto(`${BASE}/index.html#u1/${sec}`); await s.waitForSelector(".ex"); await s.waitForTimeout(400);
  assert.equal(await s.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, sec + " overflow");
}
assert.deepEqual(errors, []);
console.log("\nUNIT 1: ВСЕ ШАГИ ПРОЙДЕНЫ");
await browser.close();
