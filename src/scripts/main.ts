// Optional behavior for the portfolio. The page stays usable if this script never runs.
const root = document.documentElement;

// The inline script in BaseLayout sets data-theme before first paint.
// This function only handles a later click, and the button's accessible name.
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
      // localStorage can throw in private mode. The choice then lasts for this visit.
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

  // Close after a link is chosen, on Escape, or when the pointer goes outside.
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

  // 56rem is the header's desktop breakpoint. An open phone menu must not survive that resize.
  window.matchMedia('(min-width: 56rem)').addEventListener('change', () => setOpen(false));
}

function initScrollSpy(): void {
  if (!('IntersectionObserver' in window)) return;

  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]'));
  const byId = new Map<string, HTMLAnchorElement>();
  for (const link of links) byId.set(link.hash.slice(1), link);

  // Shrink the observed band so the current link is the section in the middle of the screen,
  // not one that is merely touching the top or bottom edge.
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

// The status element is an aria-live region. The button text change alone is not announced.
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

// .reveal is hidden only when html has .js. Without IntersectionObserver, show every item
// immediately so reduced-support browsers are not left with invisible content.
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
