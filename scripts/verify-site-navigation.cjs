/* eslint-disable @typescript-eslint/no-require-imports -- Optional external Playwright runner. */
/*
 * Existing loopback server only: never starts/restarts servers or attaches to user tabs.
 * UI_BASE_URL is mandatory; PLAYWRIGHT_MODULE/BROWSER_PATH select existing tools.
 * External traffic and EVERY non-GET request are blocked; leaderboard is a fixture.
 * No physical microphone, real ads, score submission, or audible-output claims.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
assert.ok(
  process.env.UI_BASE_URL,
  "Set UI_BASE_URL to an already running QA server",
);
const base = new URL(process.env.UI_BASE_URL);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));
const out = process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-site-navigation";
const report = {
  base: base.origin,
  startedAt: new Date().toISOString(),
  expectedBuild: process.env.EXPECTED_BUILD_ID || null,
  blockedExternal: 0,
  blockedWrites: 0,
  leaderboardFixtures: 0,
  cases: [],
  errors: [],
  alignmentFailures: [],
  limitations: [
    "Headless Chromium, not physical devices; microphone always denies before hardware access.",
    "Leaderboard and a removable 90px adhesion wrapper are synthetic; no real ads or submissions.",
    "DOM identity and MutationObserver/rAF samples cover observed commits and frames, not compositor pixels.",
    "Each locale has its own initial document; persistence is asserted within root, /ko and /de route families, not across locale root layouts.",
    "A 1200ms artificial RSC delay checks chrome persistence during a held response, not production loading performance.",
  ],
};
const modes = ["note", "ear", "interval", "chord"];
const homePath = (prefix) => prefix || "/";
const trigger = (page) =>
  page.locator("header .language-selector button[aria-haspopup=dialog]");
async function frames(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}
async function ready(page, pathname) {
  await page.waitForURL((url) => url.pathname === pathname);
  if (/\/practice\//.test(pathname))
    await page.locator("[data-practice-phase=idle]").waitFor();
  else if (pathname.endsWith("/melody"))
    await page.locator("[data-melody-phase]").waitFor();
  else await page.locator("#home-heading").waitFor();
  await frames(page);
}
async function makeContext(browser, viewport, delayPath = null) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: "reduce",
    serviceWorkers: "block",
    locale: "en-US",
  });
  const delay = { requests: [], armed: false };
  await context.addInitScript(() => {
    // A rejection fixture must never delegate to the real media API.
    window.__siteMicRequests = 0;
    if (navigator.mediaDevices)
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => {
          window.__siteMicRequests++;
          throw new DOMException(
            "QA denies physical microphone",
            "NotAllowedError",
          );
        },
      });
  });
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (request.method() !== "GET") {
      report.blockedWrites++;
      return route.abort();
    }
    if (url.origin !== base.origin) {
      report.blockedExternal++;
      return route.abort();
    }
    if (url.pathname === "/api/leaderboard") {
      report.leaderboardFixtures++;
      return route.fulfill({
        json: { entries: [], viewerCountry: null, periodDate: "2026-11-16" },
      });
    }
    const rsc = request.headers().rsc === "1" || url.searchParams.has("_rsc");
    // Avoid warming the delayed leaf before clicking it; this context is solely
    // for a controlled slow-response regression, not a prefetch behavior test.
    if (delayPath === url.pathname && rsc && !delay.armed) return route.abort();
    if (delayPath === url.pathname && rsc && delay.armed) {
      const sample = { start: Date.now(), end: null };
      delay.requests.push(sample);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      sample.end = Date.now();
    }
    return route.continue();
  });
  return { context, delay };
}
async function monitor(page) {
  await page.evaluate(() => {
    const header = document.querySelector("header");
    const s = (window.__siteNavigation = {
      document,
      header,
      logo: header.querySelector('img[alt="Note Quiz"]'),
      language: header.querySelector(
        ".language-selector button[aria-haspopup=dialog]",
      ),
      started: performance.now(),
      frames: 0,
      missingFrames: [],
      mutationsWithoutHeader: [],
      disconnected: false,
    });
    const check = () => {
      const count = document.querySelectorAll("header").length;
      if (!s.header.isConnected) s.disconnected = true;
      if (count !== 1)
        s.mutationsWithoutHeader.push({
          at: performance.now() - s.started,
          count,
        });
    };
    s.observer = new MutationObserver(check);
    s.observer.observe(document.body, { childList: true, subtree: true });
    const tick = () => {
      s.frames++;
      if (document.querySelectorAll("header").length !== 1)
        s.missingFrames.push(performance.now() - s.started);
      s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
  });
}
async function snapshot(page, pathname) {
  return page.evaluate((pathname) => {
    const s = window.__siteNavigation,
      header = document.querySelector("header");
    const rect = (node) => {
      const r = node.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        right: r.right,
        bottom: r.bottom,
      };
    };
    const owner = document.querySelector("[data-practice-scroll]");
    return {
      pathname,
      sameDocument: !!s && s.document === document,
      sameHeader: !!s && s.header === header,
      sameLogo: !!s && s.logo === header?.querySelector('img[alt="Note Quiz"]'),
      sameLanguage:
        !!s &&
        s.language ===
          header?.querySelector(
            ".language-selector button[aria-haspopup=dialog]",
          ),
      disconnected: s?.disconnected,
      missingFrames: s?.missingFrames.length,
      missingMutations: s?.mutationsWithoutHeader.length,
      frames: s?.frames,
      headers: document.querySelectorAll("header").length,
      footers: document.querySelectorAll("footer").length,
      active: [
        ...document.querySelectorAll('header nav a[aria-current="page"]'),
      ].map((a) => new URL(a.href).pathname),
      owners: document.querySelectorAll("[data-practice-scroll]").length,
      adSafeOwners: document.querySelectorAll(".practice-ad-safe").length,
      rect: rect(header),
      logo: rect(header.querySelector("img")),
      language: rect(header.querySelector(".language-selector button")),
      owner: owner
        ? {
            ...rect(owner),
            clientHeight: owner.clientHeight,
            scrollHeight: owner.scrollHeight,
            scrollTop: owner.scrollTop,
            overflow: getComputedStyle(owner).overflowY,
          }
        : null,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      headerClipping: [...header.querySelectorAll("a, button, p")].some(
        (node) => node.scrollWidth > node.clientWidth + 1,
      ),
      windowY: scrollY,
      microphoneRequests: window.__siteMicRequests,
    };
  }, pathname);
}
async function check(page, pathname, prefix, initial, steps) {
  const s = await snapshot(page, pathname);
  steps.push(s);
  for (const key of ["sameDocument", "sameHeader", "sameLogo", "sameLanguage"])
    assert.equal(s[key], true, `${pathname}: ${key}`);
  for (const key of ["disconnected", "horizontalOverflow", "headerClipping"])
    assert.equal(s[key], false, `${pathname}: ${key}`);
  assert.equal(
    s.missingFrames,
    0,
    `${pathname}: no missing-header animation frame`,
  );
  assert.equal(
    s.missingMutations,
    0,
    `${pathname}: no missing-header mutation checkpoint`,
  );
  assert.equal(s.headers, 1);
  assert.equal(s.footers, 1);
  const home = pathname === homePath(prefix),
    melody = pathname.endsWith("/melody");
  assert.deepEqual(s.active, [
    home
      ? homePath(prefix)
      : `${prefix}/${melody ? "melody" : "practice/note"}`,
  ]);
  assert.equal(s.owners, home ? 0 : 1);
  assert.equal(s.adSafeOwners, home ? 0 : 1);
  assert.equal(
    s.microphoneRequests,
    0,
    "Navigation never requests microphone access",
  );
  // Vertical coordinates may change with restored scroll; horizontal chrome stays aligned.
  for (const part of ["rect", "logo", "language"])
    for (const dimension of ["x", "width"])
      if (Math.abs(s[part][dimension] - initial[part][dimension]) > 2)
        report.alignmentFailures.push({
          pathname,
          viewport: page.viewportSize(),
          part,
          dimension,
          initial: initial[part][dimension],
          actual: s[part][dimension],
        });
  return s;
}
async function navigate(page, link, pathname, prefix, initial, steps) {
  await link.click();
  await ready(page, pathname);
  await check(page, pathname, prefix, initial, steps);
}
async function scrollAndDialog(page) {
  const owner = page.locator("[data-practice-scroll]");
  await owner.evaluate((node) =>
    node.scrollTo({ top: 0, behavior: "instant" }),
  );
  const before = await owner.evaluate((node) => ({
    height: node.clientHeight,
    scrollHeight: node.scrollHeight,
  }));
  // Use the owner's blank left padding: localized summary controls can have
  // their own small overflow regions and legitimately consume a wheel event.
  await page.mouse.move(4, Math.min(650, page.viewportSize().height - 100));
  await page.mouse.wheel(0, 700);
  if (before.scrollHeight > before.height + 2)
    await page.waitForFunction(
      () => document.querySelector("[data-practice-scroll]").scrollTop > 0,
    );
  const manualTop = await owner.evaluate((node) => node.scrollTop);
  assert.equal(
    await page.evaluate(() => scrollY),
    0,
    "Study scroll belongs to the one owner",
  );
  // Opening the existing language picker exercises dialog exit without modifying settings.
  await trigger(page).click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  const openTop = await owner.evaluate((node) => node.scrollTop);
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await frames(page);
  assert.equal(
    await trigger(page).evaluate((node) => node === document.activeElement),
    true,
    "Dialog exit returns focus",
  );
  assert.ok(
    Math.abs((await owner.evaluate((node) => node.scrollTop)) - openTop) <= 2,
    "Dialog exit preserves owner scroll",
  );
  assert.equal(
    await owner.evaluate((node) => getComputedStyle(node).overflowY),
    "auto",
  );
  assert.notEqual(
    await page.evaluate(() => getComputedStyle(document.body).overflowY),
    "hidden",
  );
  let samePathSettingsClose = null;
  if (page.viewportSize().width < 1024) {
    await owner.evaluate((node) =>
      node.scrollTo({
        top: Math.min(160, node.scrollHeight - node.clientHeight),
        behavior: "instant",
      }),
    );
    const settings = page
      .getByRole("button", { name: /settings|einstellungen|설정/i })
      .first();
    await settings.click();
    await page.locator("dialog[open]").waitFor();
    const settingsOpenTop = await owner.evaluate((node) => node.scrollTop);
    assert.ok(
      settingsOpenTop > 0,
      "Actual Settings opens at a nonzero study scroll position",
    );
    await page.keyboard.press("Escape");
    await page.locator("dialog[open]").waitFor({ state: "hidden" });
    await frames(page);
    const finalTop = await owner.evaluate((node) => node.scrollTop);
    assert.ok(
      Math.abs(finalTop - settingsOpenTop) <= 2,
      "Same-path Settings close preserves its opening scroll position",
    );
    assert.equal(
      await settings.evaluate((node) => node === document.activeElement),
      true,
    );
    assert.notEqual(
      await owner.evaluate((node) => getComputedStyle(node).overflowY),
      "hidden",
    );
    assert.notEqual(
      await page.evaluate(() => getComputedStyle(document.body).overflowY),
      "hidden",
    );
    samePathSettingsClose = { settingsOpenTop, finalTop };
  }
  await owner.evaluate((node) =>
    node.scrollTo({ top: 0, behavior: "instant" }),
  );
  return {
    ...before,
    manualTop,
    openTop,
    dialog: "Escape restores focus and scroll",
    samePathSettingsClose,
  };
}

async function crossStudyBack(page, prefix) {
  const owner = page.locator("[data-practice-scroll]");
  const melodyPath = `${prefix}/melody`,
    practicePath = `${prefix}/practice/note`;
  await owner.evaluate((node) =>
    node.scrollTo({ top: 0, behavior: "instant" }),
  );
  await page.locator(`header nav a[href="${melodyPath}"]`).click();
  await ready(page, melodyPath);
  const melodyOwner = page.locator("[data-practice-scroll]");
  await melodyOwner.evaluate((node) =>
    node.scrollTo({ top: 0, behavior: "instant" }),
  );
  await page.locator(`header nav a[href="${practicePath}"]`).click();
  await ready(page, practicePath);
  const practiceOwner = page.locator("[data-practice-scroll]");
  await practiceOwner.evaluate((node) =>
    node.scrollTo({ top: 350, behavior: "instant" }),
  );
  const practiceOrigin = await practiceOwner.evaluate((node) => node.scrollTop);
  await page.goBack();
  await ready(page, melodyPath);
  const melodyBack = await page
    .locator("[data-practice-scroll]")
    .evaluate((node) => ({
      top: node.scrollTop,
      headingY: document
        .querySelector("[data-practice-heading]")
        ?.getBoundingClientRect().y,
    }));
  assert.ok(
    melodyBack.top < 8,
    `Practice -> melody Back starts at its own top (${melodyBack.top})`,
  );
  assert.ok(
    melodyBack.headingY >= 0,
    `Melody title is visible on Back (${melodyBack.headingY})`,
  );
  await page.goForward();
  await ready(page, practicePath);
  const practiceForwardTop = await page
    .locator("[data-practice-scroll]")
    .evaluate((node) => node.scrollTop);
  assert.ok(
    practiceForwardTop < 8,
    `Melody -> practice Forward starts at its own top (${practiceForwardTop})`,
  );
  await page
    .locator("[data-practice-scroll]")
    .evaluate((node) => node.scrollTo({ top: 350, behavior: "instant" }));
  await page.goBack();
  await ready(page, melodyPath);
  await page
    .locator("[data-practice-scroll]")
    .evaluate((node) => node.scrollTo({ top: 350, behavior: "instant" }));
  await page.goForward();
  await ready(page, practicePath);
  const reverseTop = await page
    .locator("[data-practice-scroll]")
    .evaluate((node) => node.scrollTop);
  assert.ok(
    reverseTop < 8,
    `Reverse cross-study entry does not inherit stale scroll (${reverseTop})`,
  );
  let settingsBrowserBack = null;
  if (page.viewportSize().width < 1024) {
    // Establish an explicit melody -> practice entry before opening Settings.
    // Settings may replace the current URL; Back must target the prior study view.
    await page.locator(`header nav a[href="${melodyPath}"]`).click();
    await ready(page, melodyPath);
    await page.locator(`header nav a[href="${practicePath}"]`).click();
    await ready(page, practicePath);
    await practiceOwner.evaluate((node) =>
      node.scrollTo({ top: 160, behavior: "instant" }),
    );
    await page
      .getByRole("button", { name: /settings|einstellungen|설정/i })
      .first()
      .click();
    await page.locator("dialog[open]").waitFor();
    await frames(page);
    const openedTop = await practiceOwner.evaluate((node) => node.scrollTop);
    await page.goBack();
    await ready(page, melodyPath);
    await page.locator("dialog[open]").waitFor({ state: "hidden" });
    await frames(page);
    const after = await practiceOwner.evaluate((node) => ({
      top: node.scrollTop,
      overflow: getComputedStyle(node).overflowY,
    }));
    assert.equal(
      after.top,
      0,
      "Settings cleanup must not restore the prior study view scroll into melody",
    );
    assert.notEqual(after.overflow, "hidden");
    assert.notEqual(
      await page.evaluate(() => getComputedStyle(document.body).overflowY),
      "hidden",
    );
    settingsBrowserBack = {
      openedTop,
      backTop: after.top,
      destination: melodyPath,
    };
    await page.goForward();
    await ready(page, practicePath);
    if (new URL(page.url()).searchParams.get("settings") === "open") {
      await page.locator("dialog[open]").waitFor();
      await page.keyboard.press("Escape");
      await page.locator("dialog[open]").waitFor({ state: "hidden" });
    }
  }
  for (const selector of ["header", "footer"])
    assert.equal(await page.locator(selector).count(), 1);
  assert.equal(await page.locator("[data-practice-scroll]").count(), 1);
  await practiceOwner.evaluate((node) =>
    node.scrollTo({ top: 0, behavior: "instant" }),
  );
  return {
    practiceOrigin,
    melodyBack,
    practiceForwardTop,
    reverseTop,
    settingsBrowserBack,
  };
}

async function adReservation(page) {
  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.id = "site-navigation-ad-fixture";
    fixture.className = "adhesion_wrapper";
    fixture.style.cssText =
      "position:fixed;bottom:0;left:0;width:100%;height:90px;pointer-events:none;background:rgba(255,165,0,.15);z-index:999";
    fixture.textContent = "Synthetic 90px reservation fixture";
    document.body.append(fixture);
  });
  await page.waitForFunction(
    () =>
      parseFloat(
        document.documentElement.style.getPropertyValue("--ad-bottom-inset"),
      ) >= 90,
  );
  const reservation = await page
    .locator("[data-practice-scroll]")
    .evaluate((node) => ({
      bottom: node.getBoundingClientRect().bottom,
      viewport: innerHeight,
    }));
  assert.ok(
    reservation.bottom <= reservation.viewport - 90 + 1,
    "Study owner reserves synthetic bottom ad strip",
  );
  await page
    .locator("[data-practice-scroll]")
    .evaluate((node) =>
      node.scrollTo({ top: node.scrollHeight, behavior: "instant" }),
    );
  await frames(page);
  const footer = await page.locator("footer").boundingBox();
  assert.ok(
    footer.y + footer.height <= reservation.bottom + 1,
    "Footer can be scrolled above reserved ad strip",
  );
  await page.evaluate(() =>
    document.querySelector("#site-navigation-ad-fixture").remove(),
  );
  await page.waitForFunction(
    () =>
      parseFloat(
        document.documentElement.style.getPropertyValue("--ad-bottom-inset"),
      ) === 0,
  );
  await page
    .locator("[data-practice-scroll]")
    .evaluate((node) => node.scrollTo({ top: 0, behavior: "instant" }));
  return reservation;
}
async function runCase(browser, viewport, prefix, delayed = false) {
  const alignmentStart = report.alignmentFailures.length;
  const result = {
    width: viewport.width,
    height: viewport.height,
    locale: prefix || "unprefixed",
    delayed,
    status: "running",
    steps: [],
  };
  report.cases.push(result);
  const pathname = `${prefix}/practice/note`;
  const { context, delay } = await makeContext(
    browser,
    viewport,
    delayed ? pathname : null,
  );
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    report.errors.push({
      case: `${prefix}/${viewport.width}`,
      message: error.message,
    }),
  );
  try {
    const response = await page.goto(new URL(homePath(prefix), base).href, {
      waitUntil: "domcontentloaded",
    });
    assert.equal(response.status(), 200);
    if (report.expectedBuild)
      assert.ok(
        (await response.text()).includes(report.expectedBuild),
        "Expected announced build",
      );
    await ready(page, homePath(prefix));
    await trigger(page).waitFor();
    await monitor(page);
    const initial = await snapshot(page, homePath(prefix));
    await check(page, homePath(prefix), prefix, initial, result.steps);
    if (delayed) {
      delay.armed = true;
      const start = Date.now();
      await navigate(
        page,
        page.locator(`main a[href="${pathname}"]`),
        pathname,
        prefix,
        initial,
        result.steps,
      );
      assert.ok(delay.requests.length > 0, "Practice RSC really intercepted");
      assert.ok(
        delay.requests.some((r) => r.end - r.start >= 1100),
        "Response really held for 1200ms",
      );
      result.delay = {
        requests: delay.requests,
        navigationMs: Date.now() - start,
      };
    } else {
      for (const mode of modes) {
        await navigate(
          page,
          page.locator(`main a[href="${prefix}/practice/${mode}"]`),
          `${prefix}/practice/${mode}`,
          prefix,
          initial,
          result.steps,
        );
        if (mode === "note") {
          result.practiceScroll = await scrollAndDialog(page);
          result.practiceAd = await adReservation(page);
          result.crossStudyBack = await crossStudyBack(page, prefix);
        }
        await navigate(
          page,
          page.locator(`header nav a[href="${prefix}/melody"]`),
          `${prefix}/melody`,
          prefix,
          initial,
          result.steps,
        );
        if (mode === "note") {
          result.melodyScroll = await scrollAndDialog(page);
          result.melodyAd = await adReservation(page);
        }
        // Logo is part of the retained DOM and remains an operative home link.
        await navigate(
          page,
          page
            .locator("header a")
            .filter({ has: page.locator('img[alt="Note Quiz"]') }),
          homePath(prefix),
          prefix,
          initial,
          result.steps,
        );
        await page.goBack();
        await ready(page, `${prefix}/melody`);
        await check(page, `${prefix}/melody`, prefix, initial, result.steps);
        await page.goForward();
        await ready(page, homePath(prefix));
        await check(page, homePath(prefix), prefix, initial, result.steps);
      }
      // Exercise the header's basic-practice tab in addition to home mode cards.
      await navigate(
        page,
        page.locator(`header nav a[href="${prefix}/practice/note"]`),
        pathname,
        prefix,
        initial,
        result.steps,
      );
      await navigate(
        page,
        page.locator(`header nav a[href="${homePath(prefix)}"]`),
        homePath(prefix),
        prefix,
        initial,
        result.steps,
      );
    }
    await page.screenshot({
      path: path.join(
        out,
        `${prefix.slice(1) || "root"}-${viewport.width}${delayed ? "-delayed" : ""}.png`,
      ),
    });
    assert.equal(
      report.alignmentFailures.length - alignmentStart,
      0,
      "Header/logo/language alignment stays within 2px across routes",
    );
    result.status = "passed";
  } catch (error) {
    result.status = "failed";
    result.failure = error.stack || String(error);
    await page
      .screenshot({
        path: path.join(
          out,
          `failure-${prefix.slice(1) || "root"}-${viewport.width}${delayed ? "-delayed" : ""}.png`,
        ),
      })
      .catch(() => {});
  } finally {
    await context.close();
    console.log(
      `${result.locale} ${viewport.width}${delayed ? " delayed RSC" : ""}: ${result.status}`,
    );
  }
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH }
      : {}),
  });
  try {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
      { width: 520, height: 844 },
    ])
      for (const prefix of ["", "/ko", "/de"])
        await runCase(browser, viewport, prefix);
    await runCase(browser, { width: 390, height: 844 }, "/ko", true);
  } finally {
    await browser.close();
    report.finishedAt = new Date().toISOString();
    report.status =
      report.cases.length === 10 &&
      report.cases.every((c) => c.status === "passed") &&
      report.errors.length === 0 &&
      report.alignmentFailures.length === 0
        ? "passed"
        : "failed";
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify(
        {
          status: report.status,
          cases: report.cases.map(
            ({ width, locale, delayed, status, failure }) => ({
              width,
              locale,
              delayed,
              status,
              failure,
            }),
          ),
          errors: report.errors,
          alignmentFailures: report.alignmentFailures.length,
          report: path.join(out, "report.json"),
        },
        null,
        2,
      ),
    );
    if (report.status !== "passed") process.exitCode = 1;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
