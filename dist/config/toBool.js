"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toBool = toBool;
function toBool(v, def = false) {
    if (v == null)
        return def;
    const s = v.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(s))
        return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(s))
        return false;
    return def;
}
//# sourceMappingURL=toBool.js.map