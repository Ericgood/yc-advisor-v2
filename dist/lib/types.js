export function successResponse(data) {
    return { success: true, data };
}
export function errorResponse(error, details) {
    return { success: false, error, ...(details && { details }) };
}
export class AppError extends Error {
    code;
    statusCode;
    details;
    constructor(message, code, statusCode = 500, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'AppError';
    }
}
export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["INVALID_REQUEST"] = "INVALID_REQUEST";
    ErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    ErrorCode["SERVICE_ERROR"] = "SERVICE_ERROR";
    ErrorCode["TIMEOUT"] = "TIMEOUT";
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
})(ErrorCode || (ErrorCode = {}));
//# sourceMappingURL=types.js.map