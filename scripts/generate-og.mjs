// The PNGs are committed, so CI never launches a browser.
// Re-run with `npm run og` after editing scripts/og-template.html.
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

// On Windows, URL.pathname is `/C:/...`. Dropping the first character makes a real path.
const template = pathToFileURL(new URL('./og-template.html', import.meta.url).pathname.slice(1));
const publicDir = new URL('../public/', import.meta.url);

// Separate from the preview card, so a template edit does not redraw the home-screen mark.
const touchIcon = `<!doctype html><html><body style="margin:0;width:180px;height:180px;display:grid;place-items:center;background:#0c0c0c">
  <div style="width:150px;height:150px;display:grid;place-items:center;border:6px solid #f59e0b;border-radius:18px;color:#ffc174;font:700 72px/1 Arial,Helvetica,sans-serif;letter-spacing:-3px">SS</div>
</body></html>`;

const browser = await chromium.launch();
try {
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await og.goto(template.href);
  // The template's webfonts. A shot taken before they load would use the fallback face.
  await og.evaluate(() => document.fonts.ready);
  await og.screenshot({ path: new URL('og.png', publicDir).pathname.slice(1) });

  const icon = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await icon.setContent(touchIcon);
  await icon.screenshot({ path: new URL('apple-touch-icon.png', publicDir).pathname.slice(1) });
} finally {
  await browser.close();
}

console.log('Wrote public/og.png and public/apple-touch-icon.png');
