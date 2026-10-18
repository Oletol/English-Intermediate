// The Hunger Games: HG1–HG2 coming soon, HG3 и HG4 открываются по отдельности; ответы, проверка, лексика только своего фильма.
// Запуск: python3 -m http.server 5055 -d docs &  node tests/watch.e2e.mjs
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:5055", SHOTS = "/tmp/shots-hg";
mkdirSync(SHOTS, { recursive: true });
const mock = readFileSync(new URL("./mock-fb.js", import.meta.url), "utf8");
const course = readFileSync(new URL("../content-private/course.json", import.meta.url), "utf8");
const C = JSON.parse(course);
const W0 = C.units.find((u) => u.id === "w2");
const W = { sections: W0.sections.filter((x) => !x.status) };
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
await t.waitForSelector('#watch-nav .sb-uh[data-unit="w2"]');
const db = await t.evaluate(() => JSON.parse(localStorage.getItem("mock:db")));
const pub = JSON.stringify(db["unitContent/w2"]);
assert.ok(!pub.includes('"answer"'), "в unitContent нет ключей");
assert.ok(!pub.includes("Plot in brief"), "заметки преподавателя не попадают к студенту");
assert.equal(db["units/w2"].track, "watch");
assert.deepEqual(db["units/w2"].sections.map((s) => s.status || "ready"), ["soon", "soon", "ready", "ready"]);
assert.equal((await t.textContent('#watch-nav .sb-uh[data-unit="w2"] .u-n')).trim(), "HG");
await t.click('#watch-nav .sb-uh[data-unit="w2"]');
const tn = await t.locator('#watch-nav .sb-unit:has([data-unit="w2"]) .sb-item').allTextContents();
assert.equal(tn.length, 4); assert.ok(/HG1.*Coming soon/.test(tn[0]) && /HG2.*Coming soon/.test(tn[1]) && /HG3/.test(tn[2]), tn.join(" | "));
await t.goto(`${BASE}/teacher.html#w2/hg1`); await t.waitForSelector("text=still being prepared");

step("Группа и студент");
await t.click('a[href="#tools/groups"]');
await t.waitForSelector("#g-name");
await t.fill("#g-name", "Masha");
await t.fill("#g-code", "masha");
await t.click("[data-act=create-group]");
await t.waitForSelector("code:text('MASHA')");
const s = await page("/index.html");
await s.click("[data-mode=register]");
await s.fill("[name=name]", "Masha Petrova");
await s.fill("[name=email]", "masha@mail.ru");
await s.fill("[name=password]", "pass123");
await s.fill("[name=group]", "masha");
await s.click("#auth-submit");
await s.waitForSelector("text=No units are open yet");
await t.click('a[href="#tools/access"]');
await t.waitForSelector('[data-act=toggle-sec][data-sec=mj1]');
assert.equal(await t.locator('[data-act=toggle-sec][data-unit=w2][data-sec=hg1]').count(), 0, "у HG1 нет кнопки Open");
assert.equal(await t.locator('tr:has-text("Catching Fire") .pill', { hasText: "coming soon" }).count(), 1);
await t.click('[data-act=toggle-sec][data-unit=w2][data-sec=mj1]');
await s.waitForSelector('#watch-nav .sb-uh[data-unit="w2"]', { timeout: 5000 });
await s.click('#watch-nav .sb-uh[data-unit="w2"]');
assert.equal(await s.locator("#watch-nav .sb-item").count(), 1, "видна только открытая часть");
assert.equal((await s.textContent("#watch-nav .sb-item .n")).trim(), "HG3");
await s.goto(`${BASE}/index.html#w2/mj2`); await s.waitForSelector("text=This episode is not open yet");
await s.goto(`${BASE}/index.html#w2/hg1`); await s.waitForSelector("text=This episode is not open yet");
await t.click('[data-act=toggle-sec][data-unit=w2][data-sec=mj2]');
await s.waitForFunction(() => document.querySelectorAll("#watch-nav .sb-item").length === 2, null, { timeout: 5000 });

step("Студент отвечает во всех автопроверяемых упражнениях (всё верно, кроме первого пункта)");
const exs = W.sections.flatMap((sec) => sec.blocks.filter((b) => b.type === "exercise" && b.kind !== "open").map((b) => ({ ...b, sec: sec.id })));
for (const ex of exs) {
  await s.goto(`${BASE}/index.html#w2/${ex.sec}`); await s.waitForSelector(`#ex-${ex.id}`);
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
  await t.goto(`${BASE}/teacher.html#w2/${ex.sec}`);
  await t.waitForSelector(`[data-act="check-ex"][data-ex="${ex.id}"]`);
  await t.click(`[data-act="check-ex"][data-ex="${ex.id}"]`);
  await s.goto(`${BASE}/index.html#w2/${ex.sec}`);
  await s.waitForSelector(`#ex-${ex.id} .ex-score`, { timeout: 5000 });
  const n = ex.items.length;
  assert.equal((await s.textContent(`#ex-${ex.id} .ex-score`)).trim(), `${n - 1} / ${n}`, ex.id);
}
step("Проверка письма: считаются только фразы своего фильма");
for (const [ep, ex, text, foreign] of [
  ["mj1", "mj1vp6", "People of District 7! The Capitol calls us traitors, but we will not lose heart. Stand up to Snow and lay down your work tools only when the ceasefire is real. We will not be kept in the dark any longer. Do not fall apart. Fend for yourselves and help the refugees. We make our demands. We are the face of a new Panem.", /make it count|surrender/],
  ["mj2", "mj2vp6", "My children, the war was long and tedious, but also terrible. We took heavy losses, and many civilians died. People were at each other's throats. I was a piece in somebody's game, and I was played for a fool. Never underestimate fear. You only get one chance, so make it count. Remember that people are fickle. Stand up to anyone who lies to you.", /stand up to/],
]) {
  await s.goto(`${BASE}/index.html#w2/${ep}`); await s.waitForSelector(`#ex-${ex}`);
  await s.fill(sel(ex, "1"), text);
  await s.locator("#save-state", { hasText: /saved/i }).waitFor({ timeout: 5000 });
  await s.waitForTimeout(1200);
  await t.goto(`${BASE}/teacher.html#w2/${ep}`);
  await t.click(`[data-act="check-writing"][data-ex="${ex}"]`);
  await s.goto(`${BASE}/index.html#w2/${ep}`);
  await s.waitForSelector(`#ex-${ex} .wfb`, { timeout: 20000 });
  const fb = await s.textContent(`#ex-${ex} .wfb`);
  const m = fb.match(/Phrases from this episode used \((\d+) of (\d+)\)/);
  assert.ok(m, "подпись про фразы: " + fb.slice(0, 300));
  assert.equal(m[2], "25");
  assert.ok(Number(m[1]) >= 5, ep + " used " + m[1]);
  assert.ok(!foreign.test(fb.split("used")[1].split("Not in")[0]), "фразы другого фильма не засчитаны");
  console.log("   ", ep, fb.match(/Phrases from this episode used[^\n]*/)[0].slice(0, 200));
  await s.screenshot({ path: `${SHOTS}/student-${ep}.png`, fullPage: true });
  await t.goto(`${BASE}/teacher.html#w2/${ep}`); await t.waitForSelector(".keyhint");
  await t.screenshot({ path: `${SHOTS}/teacher-${ep}.png`, fullPage: true });
  assert.equal(/[→←⤮»«▼›]/.test(await s.evaluate(() => document.body.innerText)), false, "нет стрелок");
}

step("Мобильная ширина");
await s.setViewportSize({ width: 390, height: 844 });
await s.waitForTimeout(500);
for (const sec of ["mj1", "mj2"]) {
  await s.goto(`${BASE}/index.html#w2/${sec}`); await s.waitForSelector(".ex"); await s.waitForTimeout(400);
  assert.equal(await s.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, sec + " overflow");
}
assert.deepEqual(errors, []);
console.log("\nHUNGER GAMES HG3–HG4: ВСЕ ШАГИ ПРОЙДЕНЫ");
await browser.close();
