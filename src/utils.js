const path = require('path');
const fs = require('fs');
const os = require('os');
const { promisify } = require('util');
const strHash = require('string-hash');

const mkdtemp = promisify(fs.mkdtemp);
const mkdir = promisify(fs.mkdir);
const fsStat = promisify(fs.stat);

const Diff2html = require('diff2html');

const resultHtmlTemplate = ({ style, js, content }) => {
    return `<html><head><style>${style}</style><script>${js}</script></head><body>${content}</body></html>`;
};

const toJSON = diffOutput => {
    return Diff2html.parse(diffOutput);
};

const outJSON = diffOutput => {
    return JSON.stringify(toJSON(diffOutput), null, 4);
};

const outHtml = diffOutput => {
    const diffJson = toJSON(diffOutput);
    const content = Diff2html.html(diffJson, { drawFileList: true });
    const style = fs.readFileSync(
        path.join(
            __dirname,
            '../node_modules/diff2html/bundles/css/diff2html.min.css',
        ),
    );
    const js = fs.readFileSync(
        path.join(
            __dirname,
            '../node_modules/diff2html/bundles/js/diff2html.min.js',
        ),
    );

    return resultHtmlTemplate({ style, js, content });
};

const saveToFile = (filepath, content) => {
    const resultPath = path.resolve(filepath);
    fs.writeFileSync(resultPath, content);

    console.log(
        `Saved to: \n path: ${resultPath}\n uri: file:///${resultPath}`,
    );

    return resultPath;
};

const getSessionDir = async (pkg1, pkg2) => {
    const hash = strHash(pkg1 + pkg2);
    const sessionPath = path.join(os.tmpdir(), `package-diff-${hash}`);

    try {
        await fsStat(sessionPath);
    } catch (e) {
        await mkdir(sessionPath);
    }

    return sessionPath;
};

const makeTempDir = (sessionDir, suffix) => {
    return mkdtemp(path.join(sessionDir, suffix)).catch(e => {
        log(e);
    });
};

/**
 *
 * @param {string} msg
 * @param {string} type=[^log|time|timeEnd]
 */
const log = (msg, type = 'log') => {
    !log.quite && console[type](msg);
};

/**
 *
 * @param {string} diff
 * @param {string} format=[diff|html|json]
 *
 * @returns {string}
 */
const formatOutput = (diff, format) => {
    if (format === 'diff') {
        return diff;
    }
    if (format === 'html') {
        return outHtml(diff);
    }
    if (format === 'json') {
        return outJSON(diff);
    }
};

module.exports = {
    formatOutput,
    saveToFile,
    getSessionDir,
    log,
    toJSON,
    makeTempDir,
};
