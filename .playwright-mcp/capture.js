async (page) => {
  const SITE = 'https://www.jogarbumi.pt';
  const SIZES = {
    'ios-6.9': { id: 'ios-6.9', w: 440, h: 956 },
    'android-phone': { id: 'android-phone', w: 414, h: 736 },
  };
  // `code` is what the catalogue is keyed by; Portuguese is 'pt-PT' there, and storing a bare
  // 'pt' leaves the app rendering nothing at all.
  const LANGS = { pt: 'pt-PT', en: 'en', es: 'es' };
  // One size/language pair per invocation, named in job.json, to stay inside the call timeout.
  const JOB = { size: 'android-phone', lang: 'es' };
  const job = { size: SIZES[JOB.size], lang: JOB.lang, code: LANGS[JOB.lang], dir: `assets/store/${JOB.size}/${JOB.lang}` };

  const state = await page.context().storageState();
  const ctx = await page.context().browser().newContext({
    viewport: { width: job.size.w, height: job.size.h },
    deviceScaleFactor: 3,
    storageState: state,
  });
  const p = await ctx.newPage();
  const pageErrors = [];
  p.on('pageerror', e => pageErrors.push(e.message.slice(0, 160)));
  p.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text().slice(0, 160)); });
  const log = [];
  const shot = async name => { await p.screenshot({ path: `${job.dir}/${name}.png` }); log.push(name); };

  // A cold context downloads the bundle before it renders anything, so every load waits on the
  // menu itself rather than on a guessed number of seconds.
  // Polled rather than waitForFunction: the launch bounces through /loading, and the injected
  // predicate does not reliably survive that navigation.
  let probe = null;
  const ready = async () => {
    for (let attempt = 0; attempt < 12; attempt++) {
      await p.waitForTimeout(1500);
      const seen = await p.evaluate(() => ({ path: location.pathname, buttons: document.querySelectorAll('button').length })).catch(() => null);
      // The launch animation fades the splash over the menu; shooting too early catches both.
      if (seen && seen.path === '/' && seen.buttons >= 4) { await p.waitForTimeout(3500); return; }
      probe = seen;
    }
    const html = await p.evaluate(() => document.body.innerHTML.length).catch(() => -1);
    throw new Error('menu never rendered; probe ' + JSON.stringify(probe) + ' html=' + html + ' errors=' + JSON.stringify(pageErrors.slice(0, 4)));
  };

  try {
    await p.goto(SITE);
    await ready();
    await p.evaluate(l => localStorage.setItem('bumi-language-store-v1', JSON.stringify({ state: { preference: l }, version: 0 })), job.code);
    await p.goto(SITE);
    await ready();

    const menuButtons = () => p.locator('button');
    // Menu button order is stable across languages: islands, campaign, daily, training, settings.
    await shot('01-menu');

    // --- island map -------------------------------------------------------
    await menuButtons().nth(0).click();
    await p.waitForTimeout(1500);
    await p.mouse.move(job.size.w / 2, job.size.h * 0.7);
    await p.mouse.wheel(0, 200);
    await p.waitForTimeout(800);
    await shot('02-mapa-ilhas');

    // --- board mid-level: training, first 12x12 (Mestre) ------------------
    await p.keyboard.press('Escape');
    await p.waitForTimeout(800);
    await p.goto(SITE);
    await ready();
    await menuButtons().nth(3).click();
    await p.waitForTimeout(1500);
    await p.locator('button:has-text("12×12")').first().click();
    await p.waitForTimeout(3000);

    const readGrid = () => p.evaluate(() => {
      const leaves = Array.from(document.querySelectorAll('div,span'))
        .filter(el => el.children.length === 0 && /^\d+$/.test(el.textContent.trim()));
      if (!leaves.length) return null;
      const row = leaves[0].parentElement.parentElement;
      const gb = row.parentElement.getBoundingClientRect();
      const cols = row.children.length;
      const cell = gb.width / cols;
      const rows = Math.round(gb.height / cell);
      const clues = leaves.map(el => {
        const b = el.getBoundingClientRect();
        return {
          v: parseInt(el.textContent.trim(), 10),
          c: Math.floor((b.x + b.width / 2 - gb.x) / cell),
          r: Math.floor((b.y + b.height / 2 - gb.y) / cell),
        };
      }).filter(k => k.r >= 0 && k.r < rows && k.c >= 0 && k.c < cols);
      return { x: gb.x, y: gb.y, cell, rows, cols, clues };
    });

    const solve = ({ rows, cols, clues }) => {
      const owner = new Int16Array(rows * cols).fill(-1);
      const cands = clues.map(({ v, r, c }, i) => {
        const out = [];
        for (let h = 1; h <= v; h++) {
          if (v % h) continue;
          const w = v / h;
          for (let r0 = r - h + 1; r0 <= r; r0++) for (let c0 = c - w + 1; c0 <= c; c0++) {
            if (r0 < 0 || c0 < 0 || r0 + h > rows || c0 + w > cols) continue;
            let ok = true;
            for (let j = 0; j < clues.length && ok; j++) {
              if (j === i) continue;
              const o = clues[j];
              if (o.r >= r0 && o.r < r0 + h && o.c >= c0 && o.c < c0 + w) ok = false;
            }
            if (ok) out.push({ r0, c0, h, w });
          }
        }
        return out;
      });
      const placed = new Array(clues.length).fill(null);
      const fits = ({ r0, c0, h, w }) => {
        for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) if (owner[r * cols + c] !== -1) return false;
        return true;
      };
      const paint = ({ r0, c0, h, w }, id) => {
        for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) owner[r * cols + c] = id;
      };
      const step = () => {
        let best = -1, bestOpts = null;
        for (let i = 0; i < clues.length; i++) {
          if (placed[i]) continue;
          const opts = cands[i].filter(fits);
          if (!opts.length) return false;
          if (!bestOpts || opts.length < bestOpts.length) { best = i; bestOpts = opts; }
          if (opts.length === 1) break;
        }
        if (best === -1) return owner.every(v => v !== -1);
        for (const opt of bestOpts) {
          paint(opt, best); placed[best] = opt;
          if (step()) return true;
          paint(opt, -1); placed[best] = null;
        }
        return false;
      };
      return step() ? placed : null;
    };

    const place = async (g, rect) => {
      const x1 = g.x + (rect.c0 + 0.5) * g.cell;
      const y1 = g.y + (rect.r0 + 0.5) * g.cell;
      const x2 = g.x + (rect.c0 + rect.w - 0.5) * g.cell;
      const y2 = g.y + (rect.r0 + rect.h - 0.5) * g.cell;
      await p.mouse.move(x1, y1);
      await p.mouse.down();
      await p.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 3 });
      await p.mouse.move(x2, y2, { steps: 3 });
      await p.mouse.up();
      await p.waitForTimeout(60);
    };

    const training = await readGrid();
    const trainingSolution = training && solve(training);
    if (!trainingSolution) throw new Error('training solve failed');
    // Roughly three fifths of the board, scattered rather than swept, so it reads as a game in play.
    for (let i = 0; i < trainingSolution.length; i++) {
      if (i % 5 < 2) continue;
      await place(training, trainingSolution[i]);
    }
    await p.waitForTimeout(600);
    await shot('03-tabuleiro');

    // --- victory sheet: replay a solved 8x8 campaign level ----------------
    await p.goto(SITE);
    await ready();
    await menuButtons().nth(0).click();
    await p.waitForTimeout(1500);
    const level = p.locator('button[aria-label*="120"]').first();
    await level.scrollIntoViewIfNeeded();
    await p.waitForTimeout(600);
    await level.click();
    await p.waitForTimeout(3000);

    const campaign = await readGrid();
    const campaignSolution = campaign && solve(campaign);
    if (!campaignSolution) throw new Error('campaign solve failed');
    for (let i = 0; i < campaignSolution.length - 1; i++) await place(campaign, campaignSolution[i]);
    // The clock on the win sheet is real, so give it something plausible to show.
    await p.waitForTimeout(18000);
    await place(campaign, campaignSolution[campaignSolution.length - 1]);
    await p.waitForTimeout(2500);
    await shot('04-vitoria');

    // --- friends board ----------------------------------------------------
    await p.goto(SITE);
    await ready();
    await menuButtons().nth(4).click();
    await p.waitForTimeout(1500);
    await p.locator('button').nth(7).click();
    await p.waitForTimeout(3500);
    // Scrolled past the invite code: it is a live code and does not belong in a store listing.
    await p.mouse.move(job.size.w / 2, job.size.h * 0.75);
    await p.mouse.wheel(0, 260);
    await p.waitForTimeout(1000);
    await shot('05-amigos');

    return { job: `${JOB.size}/${job.lang}`, shots: log };
  } catch (e) {
    await p.screenshot({ path: `${job.dir}/ERROR.png` }).catch(() => {});
    return { job: `${JOB.size}/${job.lang}`, shots: log, error: e.message };
  } finally {
    await ctx.close();
  }
}
