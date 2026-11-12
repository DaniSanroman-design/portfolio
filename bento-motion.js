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

(() => {
    const card = document.querySelector('[data-cook-card]');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const buddy = window.PortfolioSplash;
    if (!card || motion.matches || !window.gsap || !buddy?.createAICursor || !window.IntersectionObserver) return;

    const icon = card.querySelector('.about-hat-graphic');
    const iconStyle = icon.getAttribute('style');
    const fields = [];
    let observer, timeline, cursor;
    let inView = false;
    let played = false;

    const finish = () => {
        timeline?.kill();
        observer?.disconnect();
        cursor?.remove();
        fields.forEach(({ node, source, overlay }) => {
            overlay.remove();
            source.replaceWith(...source.childNodes);
            node.classList.remove('cook-copy-field');
        });
        fields.length = 0;
        if (iconStyle === null) icon.removeAttribute('style');
        else icon.setAttribute('style', iconStyle);
        card.dataset.cookState = 'complete';
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisibility);
        motion.removeEventListener('change', onMotion);
    };

    function prepareText(node, heading) {
        const full = node.textContent;
        const lastPhrase = full.lastIndexOf(' and ');
        const split = heading ? full.lastIndexOf(' ') + 1 : lastPhrase >= 0 ? lastPhrase + 1 : full.lastIndexOf(' ', Math.floor(full.length * .72)) + 1;
        const source = document.createElement('span');
        source.className = 'cook-copy-source';
        source.append(...node.childNodes);
        const overlay = document.createElement('span');
        overlay.className = 'cook-copy-typing';
        overlay.setAttribute('aria-hidden', 'true');
        const prefix = full.slice(0, split);
        const value = document.createElement('span');
        value.className = 'cook-copy-value';
        value.textContent = prefix;
        overlay.append(value);
        const caret = document.createElement('span');
        caret.className = 'cook-caret';
        overlay.append(caret);
        node.classList.add('cook-copy-field');
        node.append(source, overlay);
        const field = { node, source, overlay, full, prefix, value, caret, breaks: [], typed: prefix };
        fields.push(field);
        measureLines(field);
        return field;
    }

    function measureLines(field) {
        const text = field.source.firstChild;
        const range = document.createRange();
        const lineHeight = parseFloat(getComputedStyle(field.node).lineHeight);
        let top;
        field.breaks = [];
        for (let index = 0; index < text.length; index++) {
            if (/\s/.test(text.data[index])) continue;
            range.setStart(text, index);
            range.setEnd(text, index + 1);
            const nextTop = range.getBoundingClientRect().top;
            if (top === undefined) top = nextTop;
            else if (Math.abs(nextTop - top) > lineHeight / 2) {
                field.breaks.push(index);
                top = nextTop;
            }
        }
        renderTyped(field, field.typed);
    }

    function renderTyped(field, value) {
        field.typed = value;
        // Keep the final paragraph's line breaks while its last words are edited.
        let wrapped = '', start = 0;
        field.breaks.forEach((index) => {
            if (index >= value.length) return;
            wrapped += value.slice(start, index).trimEnd() + '\n';
            start = index;
        });
        field.value.textContent = wrapped + value.slice(start);
        const range = document.createRange();
        const text = field.value.firstChild;
        range.setStart(text, Math.max(0, text.length - 1));
        range.setEnd(text, text.length);
        const character = range.getBoundingClientRect();
        const box = field.overlay.getBoundingClientRect();
        field.caret.style.left = `${character.right - box.left + 1}px`;
        field.caret.style.top = `${character.top - box.top}px`;
    }

    function typeText(field, from, to, at, duration, offset = 0) {
        const rhythm = buddy.config.typing.rhythm;
        const letters = Array.from(to.slice(from.length));
        const weights = letters.map((letter, index) => rhythm[(index + offset) % rhythm.length] + (/[,.]/.test(letter) ? 2 : 0));
        const total = weights.reduce((sum, weight) => sum + weight, 0);
        let time = at;
        let value = from;
        timeline.call(() => {
            field.caret.classList.add('is-typing');
            renderTyped(field, from);
        }, null, at);
        letters.forEach((letter, index) => {
            time += weights[index] / total * duration;
            value += letter;
            const typed = value;
            timeline.call(() => renderTyped(field, typed), null, time);
        });
        return time;
    }

    function eraseText(field, from, count, at) {
        let time = at;
        for (let index = 0; index < count; index++) {
            time += [.09, .12, .08, .115][index % 4];
            const typed = from.slice(0, -index - 1);
            timeline.call(() => renderTyped(field, typed), null, time);
        }
        return time;
    }

    function play() {
        if (played || document.hidden || motion.matches) return;
        played = true;
        try {
            fields.forEach(measureLines);
            card.dataset.cookState = 'playing';
            cursor = buddy.createAICursor();
            cursor.classList.add('cook-buddy');
            cursor.setAttribute('aria-hidden', 'true');
            card.append(cursor);

            const tablet = matchMedia('(min-width: 640px) and (max-width: 1023px)').matches;
            const target = { x: icon.offsetLeft + 14, y: icon.offsetTop + 14 };
            const from = tablet
                ? { x: 0, y: -Math.min(72, Math.max(24, icon.offsetTop - 16)) }
                : { x: Math.min(112, card.clientWidth - target.x - 100), y: -16 };
            gsap.set(icon, { x: from.x, y: from.y, rotation: -12, opacity: 0, transformOrigin: '20px 20px' });
            gsap.set(cursor, { x: target.x + from.x + 20, y: target.y + from.y - 12, opacity: 0 });
            timeline = gsap.timeline({ onComplete: finish, defaults: { ease: 'power2.out' } });

            const headingEnd = typeText(fields[0], fields[0].prefix, fields[0].full, .05, .5);
            timeline.call(() => fields[0].caret.classList.remove('is-typing'), null, headingEnd + .05);

            const body = fields[1];
            const correction = body.full.lastIndexOf('glorious mess');
            let textEnd;
            if (correction >= 0) {
                const draft = body.full.slice(0, correction) + 'mess';
                const draftEnd = typeText(body, body.prefix, draft, .65, 1.9);
                const erasedAt = eraseText(body, draft, 4, draftEnd + .65);
                textEnd = typeText(body, draft.slice(0, -4), body.full, erasedAt + .28, 1.3, 5);
            } else {
                textEnd = typeText(body, body.prefix, body.full, .65, 2.4);
            }
            timeline.call(() => body.caret.classList.remove('is-typing'), null, textEnd + .6);

            const buddyAt = 2.25;
            timeline.to(cursor, { opacity: 1, duration: .22 }, buddyAt)
                .to(icon, { opacity: 1, duration: .22 }, buddyAt + .18)
                .to(cursor, { x: target.x + from.x, y: target.y + from.y, duration: .48 }, buddyAt + .04)
                .to(cursor, { scale: .92, duration: .14 }, buddyAt + .56)
                .to(icon, { x: from.x * .3, y: from.y * .3 - 5, rotation: -4, duration: .78, ease: 'power1.inOut' }, buddyAt + .76)
                .to(cursor, { x: target.x + from.x * .3, y: target.y + from.y * .3 - 5, duration: .78, ease: 'power1.inOut' }, buddyAt + .76)
                .to(icon, { x: 0, y: 0, rotation: 0, duration: .42 }, buddyAt + 1.54)
                .to(cursor, { x: target.x, y: target.y, duration: .42 }, buddyAt + 1.54)
                .to(cursor, { scale: 1, duration: .16 }, buddyAt + 2.05)
                .to(cursor, { x: target.x + (tablet ? 0 : 50), y: target.y - 14, duration: .38 }, buddyAt + 2.28)
                .to(cursor, { opacity: 0, duration: .24 }, buddyAt + 2.45);
        } catch {
            finish();
        }
    }

    function onResize() {
        if (played) finish();
        else fields.forEach(measureLines);
    }
    function onVisibility() {
        if (document.hidden && played) finish();
        else if (inView) play();
    }
    function onMotion(event) {
        if (event.matches) finish();
    }

    function init() {
        if (motion.matches) return;
        try {
            observer = new IntersectionObserver(([entry]) => {
                inView = entry.isIntersecting && entry.intersectionRatio >= .45;
                if (inView) play();
                else if (played && !entry.isIntersecting) finish();
            }, { threshold: [0, .45] });
            prepareText(card.querySelector('h3'), true);
            prepareText(card.querySelector('p'), false);
            card.dataset.cookState = 'pending';
            observer.observe(card);
            window.addEventListener('resize', onResize, { passive: true });
            document.addEventListener('visibilitychange', onVisibility);
            motion.addEventListener('change', onMotion);
        } catch {
            finish();
        }
    }

    if (document.fonts) document.fonts.ready.then(init);
    else init();
})();
