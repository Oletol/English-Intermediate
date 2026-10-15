// Watch & Talk: импорт реального course.json, раздел виден студенту только после открытия.
// Запуск: python3 -m http.server 5055 -d docs &  node tests/watch.e2e.mjs
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:5055", SHOTS = "/tmp/shots-watch";
mkdirSync(SHOTS, { recursive: true });
const mock = readFileSync(new URL("./mock-fb.js", import.meta.url), "utf8");
const course = readFileSync(new URL("../content-private/course.json", import.meta.url), "utf8");
const C = JSON.parse(course);
const W = C.units.find((u) => u.id === "w1");
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

step("Преподаватель видит ключи");
await t.click('#watch-nav .sb-uh[data-unit="w1"]');
await t.click('#watch-nav .sb-item:has-text("Words to watch for")');
await t.waitForSelector(".keyhint");
await t.screenshot({ path: `${SHOTS}/01-teacher-w1.png` });

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
assert.equal(await s.locator("#watch-nav-wrap").isHidden(), true, "закрытые фильмы студенту не видны");

step("Преподаватель открывает эпизод");
await t.click('a[href="#tools/access"]');
await t.click("[data-act=toggle-open][data-unit=w1]");
await s.waitForSelector('#watch-nav .sb-uh[data-unit="w1"]', { timeout: 5000 });
await s.click('#watch-nav .sb-uh[data-unit="w1"]');
await s.click('#watch-nav .sb-item:has-text("Words to watch for")');
await s.waitForSelector(".fc");
assert.equal((await s.textContent("#content .pe")).trim(), "Watch & Talk 1 · W1.1");
assert.equal(await s.locator(".keyhint, .tnote").count(), 0, "у студента нет ключей и заметок");
await s.screenshot({ path: `${SHOTS}/02-student-words.png` });
await s.locator(".fc").screenshot({ path: `${SHOTS}/03-flashcard.png` });
await s.click(".fc-card"); await s.waitForTimeout(500);
await s.locator(".fc").screenshot({ path: `${SHOTS}/04-flashcard-back.png` });

step("Студент отвечает во всех упражнениях (всё верно, кроме одного ответа в каждом)");
const exIds = ["wd1", "st1", "st2", "vp1", "vp2", "vp3", "vp4", "vp5"];
const secOf = { wd1: "words", st1: "story", st2: "story", vp1: "practice", vp2: "practice", vp3: "practice", vp4: "practice", vp5: "practice" };
let cur = "";
for (const id of exIds) {
  if (secOf[id] !== cur) { cur = secOf[id]; await s.goto(`${BASE}/index.html#w1/${cur}`); await s.waitForSelector(`#ex-${id}`); }
  const ex = keyOf(id);
  for (const [k, it] of ex.items.entries()) {
    const right = first(it.answer);
    const v = k === 0 ? (ex.kind === "mcq" ? (right === "A" ? "B" : "A") : "zzz") : right;
    if (ex.kind === "mcq") await s.check(`${sel(id, it.id)}[value=${v}]`);
    else await s.fill(sel(id, it.id), v);
  }
}
await s.fill(sel("vp6", "1"), "My brother is a quiet person, so it was out of character for him to back down from nothing. ".repeat(3));
await s.locator("#save-state", { hasText: /saved/i }).waitFor({ timeout: 5000 });

step("Преподаватель проверяет каждое упражнение");
for (const id of exIds) {
  await t.goto(`${BASE}/teacher.html#w1/${secOf[id]}`);
  await t.waitForSelector(`[data-act="check-ex"][data-ex="${id}"]`);
  await t.click(`[data-act="check-ex"][data-ex="${id}"]`);
  await s.goto(`${BASE}/index.html#w1/${secOf[id]}`);
  await s.waitForSelector(`#ex-${id} .ex-score`, { timeout: 5000 });
  const n = keyOf(id).items.length;
  assert.equal((await s.textContent(`#ex-${id} .ex-score`)).trim(), `${n - 1} / ${n}`, id);
  assert.equal(await s.locator(`#ex-${id} .gap.bad, #ex-${id} label.bad`).count(), 1, id + " one wrong");
}
await s.goto(`${BASE}/index.html#w1/practice`); await s.waitForSelector("#ex-vp2 .ex-score");
await s.screenshot({ path: `${SHOTS}/05-student-practice-checked.png`, fullPage: true });
await s.goto(`${BASE}/index.html#w1/story`); await s.waitForSelector("#ex-st2 .ex-score");
await s.screenshot({ path: `${SHOTS}/06-student-story.png`, fullPage: true });
const txt = await s.evaluate(() => document.body.innerText);
assert.equal(/[→←⤮»«▼›]/.test(txt), false, "нет стрелок");

step("Мобильная ширина");
await s.setViewportSize({ width: 390, height: 844 });
await s.waitForTimeout(500);  // the sidebar slides away with a transition
for (const sec of ["words", "story", "practice"]) {
  await s.goto(`${BASE}/index.html#w1/${sec}`); await s.waitForSelector(".ex"); await s.waitForTimeout(400);
  assert.equal(await s.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, sec + " overflow");
}
await s.screenshot({ path: `${SHOTS}/07-mobile.png` });

assert.deepEqual(errors, []);
console.log("\nWATCH & TALK: ВСЕ ШАГИ ПРОЙДЕНЫ");
await browser.close();
