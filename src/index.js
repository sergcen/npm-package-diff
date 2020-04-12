const compare = require('./compare');
const { toJSON, log } = require('./utils');

module.exports = {
    hasDiff: (pkg1, pkg2, options = {}) => {
        options.full = false;

        return compare(pkg1, pkg2, { ...options, full: false });
    },
    compare,
    compareJSON: async (...args) => {
        const res = await compare(...args);

        if (typeof res !== 'string') return res;

        return toJSON(res);
    },
    setLogQuite: (quite) => log.quite = quite,
};
