const compare = require('./compare');
const { toJSON, log } = require('./utils');

module.exports = {
    compareJSON: async (...args) => {
        const res = await compare(...args);

        if (typeof res !== 'string') return res;

        return toJSON(res);
    },
    setLogQuite: (quite) => log.quite = quite,
    compare,
};
