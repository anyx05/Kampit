const INTERNAL_ORIGIN = 'https://kampit.invalid';
const DEFAULT_AUTH_REDIRECT = '/campgrounds';

function safeInternalPath(value) {
    if (typeof value !== 'string' || !value.startsWith('/')) return null;

    let decodedValue;
    try {
        decodedValue = decodeURIComponent(value);
    } catch {
        return null;
    }

    if (
        decodedValue.startsWith('//') ||
        decodedValue.includes('\\') ||
        /[\u0000-\u001F\u007F]/.test(decodedValue)
    ) {
        return null;
    }

    try {
        const url = new URL(value, INTERNAL_ORIGIN);
        if (url.origin !== INTERNAL_ORIGIN) return null;
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return null;
    }
}

function returnPathForRequest(req) {
    let returnTo = req.originalUrl;
    if (typeof returnTo !== 'string') return null;

    const reviewsIndex = returnTo.indexOf('/reviews');
    if (reviewsIndex !== -1) {
        returnTo = returnTo.substring(0, reviewsIndex);
    }

    return safeInternalPath(returnTo);
}

function loadReturnTo(req, res, next) {
    const returnTo = safeInternalPath(req.session?.returnTo);

    if (returnTo) {
        res.locals.returnTo = returnTo;
    } else if (req.session) {
        delete req.session.returnTo;
    }

    next();
}

function consumeReturnTo(req, res, fallback = DEFAULT_AUTH_REDIRECT) {
    const returnTo = safeInternalPath(res.locals?.returnTo)
        || safeInternalPath(req.session?.returnTo)
        || safeInternalPath(fallback)
        || DEFAULT_AUTH_REDIRECT;

    if (req.session) delete req.session.returnTo;
    if (res.locals) delete res.locals.returnTo;

    return returnTo;
}

module.exports = {
    consumeReturnTo,
    DEFAULT_AUTH_REDIRECT,
    loadReturnTo,
    returnPathForRequest,
    safeInternalPath
};
