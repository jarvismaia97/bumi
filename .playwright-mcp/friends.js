async (page) => {
  const SITE = 'https://www.jogarbumi.pt';
  const SIZES = {
    'ios-6.9': { w: 440, h: 956 },
    'android-phone': { w: 414, h: 736 },
  };
  const LANGS = { pt: 'pt-PT', en: 'en', es: 'es' };
  // Same generator the app names players with, so the stand-in reads like the rest of the board.
  const STANDIN = {
    pt: 'Kandinsky "Muitos Círculos"',
    en: 'Kandinsky "So Many Circles"',
    es: 'Kandinsky "Muchos Círculos"',
  };

  const state = await page.context().storageState();
  const done = [];

  for (const sizeId of Object.keys(SIZES)) {
    for (const lang of Object.keys(LANGS)) {
      const size = SIZES[sizeId];
      const ctx = await page.context().browser().newContext({
        viewport: { width: size.w, height: size.h },
        deviceScaleFactor: 3,
        storageState: state,
      });
      const p = await ctx.newPage();
      const ready = async () => {
        for (let attempt = 0; attempt < 12; attempt++) {
          await p.waitForTimeout(1500);
          const seen = await p.evaluate(() => ({ path: location.pathname, buttons: document.querySelectorAll('button').length })).catch(() => null);
          if (seen && seen.path === '/' && seen.buttons >= 4) { await p.waitForTimeout(3000); return; }
        }
        throw new Error('menu never rendered');
      };

      try {
        await p.goto(SITE);
        await ready();
        await p.evaluate(l => localStorage.setItem('bumi-language-store-v1', JSON.stringify({ state: { preference: l }, version: 0 })), LANGS[lang]);
        await p.goto(SITE);
        await ready();
        await p.locator('button').nth(4).click();
        await p.waitForTimeout(1500);
        await p.locator('button').nth(7).click();
        await p.waitForTimeout(3500);

        // Two things on this screen must not reach a public listing: the invite code, which is
        // live and would let any viewer onto the board, and a player whose display name is their
        // real one rather than one of the generated pseudonyms.
        const masked = await p.evaluate(standin => {
          const leaves = Array.from(document.querySelectorAll('div,span')).filter(el => el.children.length === 0 && el.textContent.trim());
          let code = 0, names = 0;
          // Six uppercase characters also describes the pt section heading QUADRO, so the code is
          // told apart by the size it is displayed at rather than by its shape alone.
          for (const el of leaves) {
            if (!/^[A-Z0-9]{6}$/.test(el.textContent.trim())) continue;
            if (parseFloat(getComputedStyle(el).fontSize) < 20) continue;
            el.textContent = 'XXXXXX';
            code++;
          }
          const pseudonym = leaves.filter(el => el.textContent.includes('"'));
          const classes = new Set(pseudonym.map(el => el.className.toString()));
          for (const el of leaves) {
            if (!classes.has(el.className.toString())) continue;
            if (el.textContent.includes('"')) continue;
            el.textContent = standin;
            names++;
          }
          return { code, names };
        }, STANDIN[lang]);

        // Left unscrolled on purpose: the sheet is taller than the shorter Android frame either
        // way, and scrolling to the bottom trades the title away to slice the code box instead.
        // A row under the pointer reveals the player's real name on hover, so the pointer has to
        // leave the board before the shutter — masking the DOM alone does not cover this.
        await p.mouse.move(size.w / 2, 6);
        await p.waitForTimeout(800);
        await p.waitForTimeout(500);
        await p.screenshot({ path: `assets/store/${sizeId}/${lang}/05-amigos.png` });
        done.push(`${sizeId}/${lang} ${JSON.stringify(masked)}`);
      } catch (e) {
        done.push(`${sizeId}/${lang} FAILED ${e.message.slice(0, 60)}`);
      } finally {
        await ctx.close();
      }
    }
  }
  return done;
}
