const quoteEl = document.getElementById('quote');
const authorEl = document.getElementById('author');
const bgPicker = document.getElementById('bg-picker');
const textPicker = document.getElementById('text-picker');
const editBtn = document.getElementById('edit-btn');
const settingsPanel = document.getElementById('settings-panel');

const storage = (typeof browser !== 'undefined') ? browser.storage.local : chrome.storage.local;

function storageGet(keys) {
    return new Promise((resolve) => storage.get(keys, resolve));
}

function storageSet(obj) {
    return new Promise((resolve) => storage.set(obj, resolve));
}

const FETCH_TIMEOUT_MS = 8000;
const REFILL_DEBOUNCE_MS = 350;
const LOW_BATCH_THRESHOLD = 5;

let refillPromise = null;
let refillDebounceTimer = null;

function randomBundledQuote() {
    const arr = BUNDLED_QUOTES;
    return arr[Math.floor(Math.random() * arr.length)];
}

/** Shuffled slice of bundled quotes for storage batch when network and cache miss. */
function shuffleBundledForFallback(count) {
    const copy = [...BUNDLED_QUOTES];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = copy[i];
        copy[i] = copy[j];
        copy[j] = t;
    }
    return copy.slice(0, Math.min(count, copy.length));
}

async function fetchRemoteQuotes() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch('https://zenquotes.io/api/quotes/', {
            signal: controller.signal,
            cache: 'default',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) throw new Error('empty payload');
        return data;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function mergeQuotesIntoStorage(newQuotes, displayImmediately) {
    const data = await storageGet(['quoteBatch']);
    const existing = data.quoteBatch || [];
    const combined = [...existing, ...newQuotes];
    await storageSet({ quoteBatch: combined });

    if (displayImmediately && newQuotes.length > 0) {
        displayQuote(newQuotes[0].q, newQuotes[0].a);
    }
}

/**
 * Refill remote quote batch. Deduplicates concurrent calls.
 * On success, caches payload for offline / timeout fallback.
 */
async function refillBatch(displayImmediately = false) {
    if (refillPromise) return refillPromise;

    refillPromise = (async () => {
        try {
            const newQuotes = await fetchRemoteQuotes();
            await storageSet({
                lastRemoteQuotes: newQuotes,
                lastRemoteQuotesAt: Date.now(),
            });
            await mergeQuotesIntoStorage(newQuotes, displayImmediately);
        } catch (_err) {
            const data = await storageGet(['quoteBatch', 'lastRemoteQuotes']);
            const existing = data.quoteBatch || [];
            let inject = Array.isArray(data.lastRemoteQuotes) ? data.lastRemoteQuotes : [];
            if (inject.length === 0) inject = shuffleBundledForFallback(15);
            const combined = [...existing, ...inject];
            await storageSet({ quoteBatch: combined });

            if (displayImmediately && inject.length > 0) {
                displayQuote(inject[0].q, inject[0].a);
            } else if (displayImmediately) {
                const b = randomBundledQuote();
                displayQuote(b.q, b.a);
            }
        } finally {
            refillPromise = null;
        }
    })();

    return refillPromise;
}

function scheduleRefill() {
    if (refillDebounceTimer) clearTimeout(refillDebounceTimer);
    refillDebounceTimer = setTimeout(() => {
        refillDebounceTimer = null;
        refillBatch(false);
    }, REFILL_DEBOUNCE_MS);
}

// --- 1. CORE LOGIC: THE SMART BATCHER ---

async function getNextQuote() {
    storage.get(['quoteBatch', 'bgColor', 'textColor'], async (data) => {
        if (data.bgColor) document.body.style.backgroundColor = data.bgColor;
        if (data.textColor) document.body.style.color = data.textColor;

        const batch = data.quoteBatch || [];

        if (batch.length > 0) {
            const current = batch.shift();
            displayQuote(current.q, current.a);
            storage.set({ quoteBatch: batch });

            if (batch.length < LOW_BATCH_THRESHOLD) scheduleRefill();
        } else {
            const b = randomBundledQuote();
            displayQuote(b.q, b.a);
            scheduleRefill();
        }
    });
}

function displayQuote(text, author) {
    quoteEl.textContent = `"${text}"`;
    authorEl.textContent = `- ${author}`;
}

// --- 2. SETTINGS & COLORS ---

editBtn.addEventListener('click', () => settingsPanel.classList.toggle('hidden'));

bgPicker.addEventListener('input', (e) => {
    document.body.style.backgroundColor = e.target.value;
    storage.set({ bgColor: e.target.value });
});

textPicker.addEventListener('input', (e) => {
    document.body.style.color = e.target.value;
    storage.set({ textColor: e.target.value });
});

// Start!
getNextQuote();
