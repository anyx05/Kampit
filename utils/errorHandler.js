class ExpressError extends Error {
    constructor(message, statusCode) {
        super();
        this.message = message;
        this.statusCode = statusCode;
    }
}

const catchAsync = function (fn) {
    return (req, res, next) => {
        return Promise.resolve(fn(req, res, next)).catch(next);
    }
}

module.exports = { ExpressError, catchAsync }
