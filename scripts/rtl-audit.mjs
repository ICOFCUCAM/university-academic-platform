// ---------------------------------------------------------------------------
// MEASURING THE RIGHT-TO-LEFT PAGE, BECAUSE READING THE SOURCE DOES NOT SHOW IT.
//
// Every defect this script checks for was found by looking at pixels, not by
// reasoning about CSS:
//
//   the document was left-to-right while a div inside it was not, so the
//   scrollbar and the native controls stayed on the wrong side;
//   the sidebar's rule sat on the screen edge instead of the edge facing the
//   content, because the class was `border-r` rather than `border-e`;
//   and every untranslated English sentence had its full stop on the left.
//
// It needs a build and a browser, so it is not part of `npm test`. Run it with
// `npm run check:rtl` after `npm run build`.
// ---------------------------------------------------------------------------

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = process.env.PORT ?? 3199;
const BASE = `http://localhost:${PORT}`;
const CHROME = process.env.CHROME
  ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  }
};

// THE PORT MUST BE FREE, AND THIS CHECK EARNED ITS PLACE IMMEDIATELY: with a
// stray server left over from an earlier run, this script started a second one
// that could not bind, found the old one answering, and reported that a fix it
// had never loaded was working. A check that measures somebody else's build is
// worse than no check.
try {
  const stray = await fetch(BASE, { signal: AbortSignal.timeout(1500) });
  if (stray) {
    console.error(`Something is already serving ${BASE}. Stop it first: this script starts its own.`);
    process.exit(1);
  }
} catch { /* nothing there, which is what we want */ }

// `detached` so the whole group can be killed: `npx` starts the real server as
// a child, and killing the wrapper alone leaves it holding the port — which is
// how the stray above came to exist in the first place.
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  env: { ...process.env, NEXT_PUBLIC_ENABLE_DEMO: 'true' },
  stdio: 'ignore',
  detached: true,
});
server.on('exit', (code) => {
  if (code !== null && code !== 0) {
    console.error(`The server exited with ${code} before the checks could run.`);
    process.exit(1);
  }
});

const ready = async () => {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(BASE);
      if (response.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
};

try {
  if (!await ready()) throw new Error(`No server on ${BASE}`);

  const browser = await chromium.launch({ executablePath: CHROME });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies([{ name: 'academic_actor', value: 'person-registry', url: BASE }]);
  const page = await context.newPage();

  // Move the demonstration student into Arabic, then look through their eyes.
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle' });
  await page.evaluate(() => fetch('/api/profile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'working-language', personId: 'person-student',
      language: 'ar', reason: 'Checking the right-to-left layout',
    }),
  }).then((r) => r.json()));

  const student = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await student.addCookies([{ name: 'academic_actor', value: 'person-student', url: BASE }]);
  const view = await student.newPage();
  await view.goto(`${BASE}/courses`, { waitUntil: 'networkidle' });

  const measured = await view.evaluate(() => {
    const aside = document.querySelector('aside');
    const box = aside.getBoundingClientRect();
    const style = getComputedStyle(aside);
    const card = document.querySelector('section[lang]');
    const sentence = [...document.querySelectorAll('p')]
      .find((p) => /central object/.test(p.textContent ?? ''));
    return {
      documentDir: document.documentElement.getAttribute('dir'),
      bodyDirection: getComputedStyle(document.body).direction,
      asideOnTheRight: Math.round(box.right) === window.innerWidth,
      // The rule belongs on the edge facing the content, not the screen edge.
      ruleFacesContent: style.borderLeftWidth !== '0px' && style.borderRightWidth === '0px',
      cardLang: card?.getAttribute('lang'),
      cardDirection: card ? getComputedStyle(card).direction : null,
      englishSentenceBidi: sentence ? getComputedStyle(sentence).unicodeBidi : null,
    };
  });

  check('the document itself is right-to-left', measured.documentDir, 'rtl');
  check('…and so is the body', measured.bodyDirection, 'rtl');
  check('the navigation mirrors to the right', measured.asideOnTheRight, true);
  check('…with its rule on the edge facing the content', measured.ruleFacesContent, true);
  check('a course card says which language it is in', measured.cardLang, 'en');
  check('…and is laid out in that language, not the reader’s', measured.cardDirection, 'ltr');
  check('untranslated English sentences resolve their own direction',
    measured.englishSentenceBidi, 'plaintext');

  await browser.close();
} finally {
  try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill(); }
}

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
