(() => {
    const section = document.querySelector('#about');
    const cards = [...(section?.querySelectorAll('.about-layout .floating-module') || [])];
    if (!cards.length) return;

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const revealed = new WeakSet();
    let observer;

    const finish = (card) => {
        revealed.add(card);
        card.classList.remove('bento-pending', 'bento-entering');
        card.classList.add('bento-revealed');
        card.style.removeProperty('--bento-delay');
        card.style.removeProperty('--bento-angle');
    };

    cards.forEach((card) => {
        card.addEventListener('animationend', (event) => {
            if (event.target === card && event.animationName === 'bento-arrive') finish(card);
        });
        card.addEventListener('focusin', () => {
            observer?.unobserve(card);
            finish(card);
        });
    });

    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
        cards.forEach(finish);
        return;
    }

    const revealBatch = (entries) => {
        const entering = entries
            .filter((entry) => entry.isIntersecting && !revealed.has(entry.target))
            .map((entry) => entry.target)
            .sort((a, b) => a.offsetTop - b.offsetTop || cards.indexOf(a) - cards.indexOf(b));
        const rows = [];

        entering.forEach((card) => {
            const top = card.offsetTop;
            let row = rows.findIndex((rowTop) => Math.abs(rowTop - top) < 2);
            if (row === -1) row = rows.push(top) - 1;
            const peers = cards.filter((other) => Math.abs(other.offsetTop - top) < 2);
            card.style.setProperty('--bento-delay', `${row * 180 + peers.indexOf(card) * 75}ms`);
            revealed.add(card);
            observer.unobserve(card);
            card.classList.remove('bento-pending');
            card.classList.add('bento-entering');
        });
    };

    try {
        observer = new IntersectionObserver(revealBatch, {
            rootMargin: '0px 0px -10% 0px',
            threshold: 0.01,
        });
        cards.forEach((card, index) => {
            card.style.setProperty('--bento-angle', `${[-0.45, 0.35, -0.25][index % 3]}deg`);
            card.classList.add('bento-pending');
            observer.observe(card);
        });
    } catch {
        observer?.disconnect();
        cards.forEach(finish);
    }

    reducedMotion.addEventListener('change', (event) => {
        if (!event.matches) return;
        observer?.disconnect();
        cards.forEach(finish);
    });
})();
