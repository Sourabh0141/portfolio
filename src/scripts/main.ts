/**
 * Progressive enhancement for the portfolio. Every feature here is optional:
 * the page is fully usable and readable without this script.
 */

const root = document.documentElement;

function initTheme(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  if (!button) return;

  const syncLabel = (): void => {
    const next = root.dataset['theme'] === 'dark' ? 'light' : 'dark';
    button.setAttribute('aria-label', `Switch to ${next} theme`);
  };

  button.addEventListener('click', () => {
    const next = root.dataset['theme'] === 'dark' ? 'light' : 'dark';
    root.dataset['theme'] = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* storage unavailable: the choice simply lasts for this visit */
    }
    syncLabel();
  });

  syncLabel();
}

function initNav(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-menu-button]');
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  if (!button || !nav) return;

  const isOpen = (): boolean => button.getAttribute('aria-expanded') === 'true';
  const setOpen = (open: boolean): void => {
    button.setAttribute('aria-expanded', String(open));
    nav.toggleAttribute('data-open', open);
  };

  button.addEventListener('click', () => setOpen(!isOpen()));

  // Close after choosing a destination, on Escape, or when tapping outside.
  nav.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener('click', (event) => {
    const target = event.target as Node;
    if (isOpen() && !nav.contains(target) && !button.contains(target)) setOpen(false);
  });

  // Reset when resizing up to the desktop layout.
  window.matchMedia('(min-width: 56rem)').addEventListener('change', () => setOpen(false));
}

/** Marks the nav link of the section currently in view. */
function initScrollSpy(): void {
  if (!('IntersectionObserver' in window)) return;

  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]'));
  const byId = new Map<string, HTMLAnchorElement>();
  for (const link of links) byId.set(link.hash.slice(1), link);

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const link of links) link.removeAttribute('aria-current');
        byId.get(entry.target.id)?.setAttribute('aria-current', 'true');
      }
    },
    { rootMargin: '-35% 0px -60% 0px' },
  );

  for (const id of byId.keys()) {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  }
}

function initCopy(): void {
  const status = document.querySelector<HTMLElement>('[data-copy-status]');

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
    const idle = button.querySelector<HTMLElement>('[data-copy-idle]');
    const done = button.querySelector<HTMLElement>('[data-copy-done]');
    const text = button.dataset['copy'] ?? '';
    const label = button.dataset['copyLabel'] ?? 'text';
    let timer: number | undefined;

    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        if (status) status.textContent = `Couldn’t copy the ${label}. Please copy it manually.`;
        return;
      }

      if (idle) idle.hidden = true;
      if (done) done.hidden = false;
      if (status) status.textContent = `Copied the ${label}.`;

      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (idle) idle.hidden = false;
        if (done) done.hidden = true;
      }, 2000);
    });
  }
}

function initReveal(): void {
  const items = document.querySelectorAll<HTMLElement>('.reveal');
  if (!('IntersectionObserver' in window)) {
    for (const item of items) item.classList.add('is-visible');
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );

  for (const item of items) observer.observe(item);
}

initTheme();
initNav();
initScrollSpy();
initCopy();
initReveal();
