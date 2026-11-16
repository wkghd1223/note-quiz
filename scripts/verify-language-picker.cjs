/* eslint-disable @typescript-eslint/no-require-imports */
// Read-only Chromium checks against an independently built and started QA snapshot.
// No server launch, dependency install, Google ingestion, or physical-device claims.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
for (const name of [
  "UI_BASE_URL",
  "EXPECTED_BUILD_ID",
  "PLAYWRIGHT_MODULE",
  "BROWSER_PATH",
])
  assert.ok(process.env[name], `${name} is required`);
const base = new URL(process.env.UI_BASE_URL);
assert.ok(["http:", "https:"].includes(base.protocol));
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname),
  "loopback QA only",
);
assert.notEqual(base.port, "3001", "user3001 is protected");
assert.equal(base.username + base.password + base.search + base.hash, "");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const out = process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-language-picker-qa";
const report = {
  base: base.origin,
  expectedBuild: process.env.EXPECTED_BUILD_ID,
  transport: "all external and write requests blocked; controlled GA script",
  physicalDevice: false,
  cases: [],
  errors: [],
  blockedExternal: 0,
  blockedWrites: 0,
};
const names = [
  "English",
  "한국어",
  "日本語",
  "Español",
  "Deutsch",
  "Français",
  "简体中文",
  "Português (Brasil)",
  "Русский",
  "ქართული",
  "Esperanto",
];
const trigger = (page) =>
  page.locator(".language-selector button[aria-haspopup=dialog]");
const dialog = (page) => page.getByRole("dialog");
const option = (page, name) =>
  page.getByRole("menuitemradio", { name, exact: true });
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) <= 2, `${actual} near ${expected}`);
async function focused(page, name) {
  await page.waitForFunction(
    (label) => document.activeElement?.textContent.trim() === label,
    name,
  );
}
async function opened(page) {
  await trigger(page).click();
  await dialog(page).waitFor({ state: "visible" });
}
async function closed(page) {
  await dialog(page).waitFor({ state: "hidden" });
  assert.equal(
    await trigger(page).evaluate(
      (element) => element === document.activeElement,
    ),
    true,
  );
}
async function bounds(page) {
  const rect = await dialog(page).boundingBox();
  assert.ok(rect);
  const viewport = page.viewportSize();
  assert.ok(
    rect.x >= -1 &&
      rect.y >= -1 &&
      rect.x + rect.width <= viewport.width + 1 &&
      rect.y + rect.height <= viewport.height + 1,
  );
  return rect;
}
async function openRoute(page, route) {
  const response = await page.goto(new URL(route, base.origin).href, {
    waitUntil: "domcontentloaded",
  });
  assert.ok(response.ok(), `HTTP ${response.status()}`);
  assert.ok(
    (await response.text()).includes(process.env.EXPECTED_BUILD_ID),
    "build ID mismatch",
  );
  await trigger(page).waitFor({ state: "visible" });
}
async function makeContext(browser, viewport, { blockedStorage = false } = {}) {
  const context = await browser.newContext({ viewport, locale: "en-US" });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method())) {
      report.blockedWrites++;
      return route.abort();
    }
    if (
      url.hostname === "www.googletagmanager.com" &&
      url.pathname === "/gtag/js"
    )
      return route.fulfill({
        contentType: "application/javascript",
        body: "window.__pickerControlledGA = true;",
      });
    if (url.origin !== base.origin) {
      report.blockedExternal++;
      return route.abort();
    }
    if (url.pathname === "/api/leaderboard")
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          viewerCountry: {
            countryCode: "XX",
            countryName: "Unknown",
            flag: "",
          },
          entries: [],
          periodDate: "2026-11-16",
        }),
      });
    return route.continue();
  });
  if (blockedStorage)
    await context.addInitScript(() => {
      for (const key of ["getItem", "setItem", "removeItem"])
        Storage.prototype[key] = () => {
          throw new DOMException("Controlled blocked storage", "SecurityError");
        };
    });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (error) => report.errors.push(error.message));
  return { context, page };
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH,
  });
  async function test(name, run) {
    try {
      report.cases.push({ name, passed: true, evidence: await run() });
      console.log("PASS", name);
    } catch (error) {
      report.cases.push({ name, passed: false, error: String(error) });
      console.error("FAIL", name, String(error));
    }
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(report, null, 2),
    );
  }
  try {
    await test("1280 anchor, eleven native names, selected focus, keyboard and same-value no-op", async () => {
      const { context, page } = await makeContext(browser, {
        width: 1280,
        height: 900,
      });
      try {
        await openRoute(page, "/en/practice/note?picker=keep#history");
        await page.evaluate(() =>
          document.body.style.setProperty("overflow", "clip", "important"),
        );
        const original = await page.evaluate(() => ({
          url: location.href,
          storage: localStorage.getItem("language-storage"),
          time: performance.timeOrigin,
        }));
        await opened(page);
        await focused(page, "English");
        const anchor = await trigger(page).boundingBox(),
          rect = await bounds(page);
        near(rect.x + rect.width, anchor.x + anchor.width);
        near(rect.y, anchor.y + anchor.height + 6);
        assert.deepEqual(
          await page.getByRole("menuitemradio").allTextContents(),
          names,
        );
        assert.equal(
          await option(page, "English").getAttribute("aria-checked"),
          "true",
        );
        await page.keyboard.press("ArrowUp");
        await focused(page, "Esperanto");
        await page.keyboard.press("ArrowDown");
        await focused(page, "English");
        await page.keyboard.press("End");
        await focused(page, "Esperanto");
        await page.keyboard.press("Home");
        await focused(page, "English");
        await page.keyboard.type("po");
        await focused(page, "Português (Brasil)");
        assert.equal(
          await option(page, "English").getAttribute("aria-checked"),
          "true",
        );
        await page.waitForTimeout(650); // the specified typeahead expiry, not readiness
        await page.keyboard.type("d");
        await focused(page, "Deutsch");
        await option(page, "Deutsch").evaluate((element) =>
          element.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "e",
              isComposing: true,
              bubbles: true,
            }),
          ),
        );
        await focused(page, "Deutsch");
        await page.keyboard.press("Control+e");
        await focused(page, "Deutsch");
        await page.keyboard.press("Home");
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await dialog(page)
            .getByRole("button")
            .evaluate((element) => element === document.activeElement),
          true,
        );
        await page.keyboard.press("Tab");
        await focused(page, "English");
        await page.keyboard.press("Tab");
        await focused(page, "한국어");
        await page.keyboard.press("Shift+Tab");
        await focused(page, "English");
        assert.equal(
          await page
            .getByRole("menuitemradio")
            .evaluateAll(
              (elements) =>
                elements.filter((element) => element.tabIndex === 0).length,
            ),
          1,
        );
        await page.waitForLoadState("networkidle");
        const requests = [];
        const record = (request) => requests.push(request.url());
        page.on("request", record);
        await page.keyboard.press("Space");
        await closed(page);
        await page.waitForTimeout(200); // absence of no-op requests after semantic close
        page.off("request", record);
        assert.deepEqual(requests, []);
        const after = await page.evaluate(() => ({
          url: location.href,
          storage: localStorage.getItem("language-storage"),
          time: performance.timeOrigin,
        }));
        assert.deepEqual(after, original);
        assert.deepEqual(
          await page.evaluate(() => [
            document.body.style.getPropertyValue("overflow"),
            document.body.style.getPropertyPriority("overflow"),
          ]),
          ["clip", "important"],
        );
        await page.screenshot({ path: path.join(out, "desktop-closed.png") });
        return {
          anchor,
          rect,
          noOpRequests: requests.length,
          overflowRestored: true,
        };
      } finally {
        await context.close();
      }
    });
    await test("above fallback, capture-scroll reposition, resize to sheet and back", async () => {
      const { context, page } = await makeContext(browser, {
        width: 1280,
        height: 900,
      });
      try {
        await openRoute(page, "/en/practice/ear");
        await trigger(page).evaluate((element) => {
          element.style.position = "fixed";
          element.style.top = "820px";
          element.style.right = "20px";
        });
        await opened(page);
        let rect = await bounds(page),
          anchor = await trigger(page).boundingBox();
        near(rect.y + rect.height + 6, anchor.y);
        await trigger(page).evaluate((element) => {
          element.style.top = "40px";
          window.dispatchEvent(new Event("scroll"));
        });
        rect = await bounds(page);
        anchor = await trigger(page).boundingBox();
        near(rect.y, anchor.y + anchor.height + 6);
        const waitForResizedPicker = async (width, height) =>
          page.waitForFunction(
            ({ button, width, height }) => {
              const panel = document.getElementById(
                button.getAttribute("aria-controls"),
              );
              const desktop = width >= 768;
              if (
                !(panel instanceof HTMLDialogElement) ||
                !panel.open ||
                window.innerWidth !== width ||
                window.innerHeight !== height ||
                window.matchMedia("(min-width: 768px)").matches !== desktop
              )
                return false;
              const rect = panel.getBoundingClientRect();
              const anchor = button.getBoundingClientRect();
              const near = (actual, expected) => Math.abs(actual - expected) <= 2;
              if (
                rect.width <= 0 || rect.height <= 0 ||
                rect.x < -1 || rect.y < -1 ||
                rect.right > width + 1 || rect.bottom > height + 1
              )
                return false;
              return desktop
                ? panel.style.left !== "" && panel.style.top !== "" &&
                    near(rect.right, anchor.right) &&
                    near(rect.y, anchor.bottom + 6)
                : panel.style.left === "" && panel.style.top === "" &&
                    near(rect.x, 0) && near(rect.width, width) &&
                    near(rect.bottom, height);
            },
            { button: await trigger(page).elementHandle(), width, height },
            { timeout: 5000 },
          );
        await page.setViewportSize({ width: 390, height: 420 });
        await waitForResizedPicker(390, 420);
        rect = await bounds(page);
        near(rect.x, 0);
        near(rect.width, 390);
        near(rect.y + rect.height, 420);
        assert.deepEqual(
          await dialog(page).evaluate((element) => [
            element.style.left,
            element.style.top,
          ]),
          ["", ""],
        );
        await page.setViewportSize({ width: 1280, height: 900 });
        await waitForResizedPicker(1280, 900);
        rect = await bounds(page);
        anchor = await trigger(page).boundingBox();
        near(rect.y, anchor.y + anchor.height + 6);
        await page.screenshot({ path: path.join(out, "desktop-open.png") });
        await page.keyboard.press("Escape");
        await closed(page);
        return { rect, anchor };
      } finally {
        await context.close();
      }
    });
    for (const width of [320, 390])
      await test(`${width}px sheet, fixed header, scroll, long Portuguese, blank panel and backdrop`, async () => {
        const { context, page } = await makeContext(browser, {
          width,
          height: 420,
        });
        try {
          await openRoute(page, "/pt/practice/note");
          assert.ok(
            (await trigger(page).getAttribute("aria-label")).includes(
              "Português (Brasil)",
            ),
          );
          await opened(page);
          const rect = await bounds(page);
          near(rect.x, 0);
          near(rect.width, width);
          near(rect.y + rect.height, 420);
          await focused(page, "Português (Brasil)");
          const header = dialog(page).locator("h2");
          const headerBefore = await header.boundingBox();
          const list = page.getByRole("menu");
          assert.ok(
            await list.evaluate(
              (element) => element.scrollHeight > element.clientHeight,
            ),
          );
          await page.keyboard.press("End");
          await focused(page, "Esperanto");
          assert.deepEqual(await header.boundingBox(), headerBefore);
          const last = await option(page, "Esperanto").boundingBox(),
            listBox = await list.boundingBox();
          assert.ok(
            last.y >= listBox.y - 1 &&
              last.y + last.height <= listBox.y + listBox.height + 1,
          );
          // Border/padding inside the panel is deliberately inert.
          await page.mouse.click(rect.x + 2, rect.y + 2);
          assert.equal(await dialog(page).isVisible(), true);
          await page.screenshot({ path: path.join(out, `sheet-${width}.png`) });
          await page.mouse.click(width / 2, Math.max(1, rect.y - 10));
          await closed(page);
          assert.equal(
            await page.evaluate(() => document.body.style.overflow),
            "",
          );
          await opened(page);
          await dialog(page).getByRole("button").click();
          await closed(page);
          return { rect, headerBefore, last, listBox };
        } finally {
          await context.close();
        }
      });
    await test("route query/hash preservation, Enter selection and unprefixed in-place language", async () => {
      const { context, page } = await makeContext(browser, {
        width: 1280,
        height: 900,
      });
      try {
        const suffix = "?sound=1&picker=a%2Fb#history";
        await openRoute(page, `/en/practice/ear${suffix}`);
        await opened(page);
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await page.waitForURL(`${base.origin}/ko/practice/ear${suffix}`);
        await page.waitForFunction(
          () =>
            document.querySelector(
              ".language-selector button[aria-haspopup=dialog]",
            )?.dataset.value === "ko",
        );
        const additions = [
          ["ru", "Русский"],
          ["ka", "ქართული"],
          ["eo", "Esperanto"],
        ];
        for (const [language, nativeName] of additions) {
          await opened(page);
          await option(page, nativeName).click();
          await page.waitForURL(
            `${base.origin}/${language}/practice/ear${suffix}`,
          );
          await page.waitForFunction(
            (value) =>
              document.querySelector(
                ".language-selector button[aria-haspopup=dialog]",
              )?.dataset.value === value,
            language,
          );
          assert.equal(
            await trigger(page).getAttribute("aria-expanded"),
            "false",
          );
        }
        await openRoute(page, "/practice/ear?picker=keep#history");
        const before = await page.evaluate(() => ({
          url: location.href,
          time: performance.timeOrigin,
        }));
        for (const [language, nativeName] of additions) {
          await opened(page);
          await option(page, nativeName).click();
          await closed(page);
          await page.waitForFunction(
            (value) => document.documentElement.lang === value,
            language,
          );
          assert.equal(
            await trigger(page).getAttribute("data-value"),
            language,
          );
          assert.deepEqual(
            await page.evaluate(() => ({
              url: location.href,
              time: performance.timeOrigin,
            })),
            before,
          );
        }
        return {
          suffix,
          unprefixed: before.url,
          languages: additions.map(([language]) => language),
        };
      } finally {
        await context.close();
      }
    });
    await test("blocked storage still permits in-place language and picker close", async () => {
      const { context, page } = await makeContext(
        browser,
        { width: 390, height: 844 },
        { blockedStorage: true },
      );
      try {
        await openRoute(page, "/practice/note");
        const url = page.url();
        await opened(page);
        await option(page, "한국어").click();
        await closed(page);
        await page.waitForFunction(
          () => document.documentElement.lang === "ko",
        );
        assert.equal(page.url(), url);
        return { url, blockedStorage: true };
      } finally {
        await context.close();
      }
    });
    assert.deepEqual(report.errors, [], "uncaught application errors");
    assert.ok(
      report.cases.every((entry) => entry.passed),
      "picker cases failed",
    );
  } finally {
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(report, null, 2),
    );
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
