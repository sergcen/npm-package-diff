const path = require('path');
const os = require('os');
const execa = require('execa');
const fs = require('fs');
const micromatch = require('micromatch');
const { promisify } = require('util');

const fsStat = promisify(fs.stat);
const npa = require('npm-package-arg');

const { log, makeTempDir, getSessionDir } = require('./utils');

const execDiff = async ({ dir1, dir2, exclude, toStdOut = false }) => {
    const excludeParam = exclude ? '--exclude=' + exclude : '';

    const res = execa(
        'bash',
        [
            '-c',
            [
                'diff',
                '-r',
                '--new-file',
                '--unified',
                excludeParam,
                dir2,
                dir1,
            ].join(' ') + ' || true',
        ],
        {
            stdio: toStdOut ? 'inherit' : undefined,
        },
    );
    const { stdout } = await res;

    return stdout;
};

const execFastDiff = async args => {
    const {
        dir1,
        list,
        exclude,
        options: { hooks = {} },
    } = args;

    if (list.length === 0) return true;

    const input = list.map(p => p.join(' ')).join(' ');

    const excludeParam = exclude ? '--exclude=' + exclude : '';
    const cmd = execa(
        'xargs',
        [
            '-n2',
            'sh',
            '-c',
            `diff ${excludeParam} --new-file -q $0 $1 || exit 255`,
        ],
        { input },
    );

    let result = false;
    try {
        await cmd;

        result = true;
    } catch (e) {
        const { stdout, stderr } = e;
        const start = stdout.indexOf(dir1);
        const end = stdout.indexOf(' ', start);
        const filepath = stdout.slice(start, end);
        const failedItemIndex = list.findIndex(([path1]) => path1 === filepath);

        if (hooks.afterFail && (await hooks.afterFail(list[failedItemIndex])) === true) {
            result = await execFastDiff({
                ...args,
                list: list.slice(failedItemIndex + 1),
            });
        }
    }

    return result;
};

const exec = async (cmd, options = {}) => {
    try {
        if (!options.stdio) {
            const { stdout } = await execa('bash', ['-c', cmd], options);

            return stdout.trim();
        } else {
            execa('bash', ['-c', cmd], options);
        }
    } catch (e) {
        throw Error(`Error while exec cmd: '${cmd}'\n${e}`);
    }
};

const getFilesList = async (path, { exclude }) => {
    const stdout = await exec(`tar -tf ${path}`);
    let files = stdout
        .trim()
        .split(os.EOL)
        .filter(Boolean)
        .sort();

    if (exclude) {
        files = micromatch.not(files, exclude);
    }

    return files;
};

const buildCompareFileList = (dir1, dir2, list1, list2) => {
    const list = [...new Set([...list1, ...list2])];

    return list.map(p => [path.join(dir1, p), path.join(dir2, p)]);
};

const listDiff = (list1, list2) => {
    const list1Set = new Set(list1);
    const list2Set = new Set(list2);

    const added = list1.filter(filename => !list2Set.has(filename));
    const removed = list2.filter(filename => !list1Set.has(filename));

    return {
        added,
        removed,
        diffCount: added.length + removed.length,
    };
};

const getPackageTarPath = async ({
    pkg,
    downloadPath,
    firstPackage,
    options,
}) => {
    const parsedPkgArg = npa(pkg);
    const { name, type, fetchSpec, rawSpec } = parsedPkgArg;

    if (type === 'file') {
        const tarPath = fetchSpec;
        try {
            await fsStat(tarPath);
        } catch (e) {
            throw Error(`Cannot open file ${tarPath}`);
        }

        return tarPath;
    }

    let fetchName = `${name}@${fetchSpec}`;

    // if format isn't full ex. '1.0.0'|'latest'|'next'
    if (!rawSpec && firstPackage) {
        const { name: firstPackageName } = npa(firstPackage);

        fetchName = `${firstPackageName}@${pkg}`;
    }

    log(`${fetchName}: downloading...`);
    log(`${fetchName}: done`, 'time');

    let extendNpmArgs = [];
    options.preferOffline && extendNpmArgs.push('--prefer-offline');
    options.registry && extendNpmArgs.push(`--registry=${options.registry}`);

    const result = await exec(
        `npm pack ${fetchName} ${extendNpmArgs.join(' ')}`,
        { cwd: downloadPath },
    );
    log(`${fetchName}: done`, 'timeEnd');

    const filename = result.split(os.EOL).slice(-1)[0];

    return path.join(downloadPath, filename);
};

const unpack = async (tar, sessionDir) => {
    const dir = await makeTempDir(sessionDir, 'unpack');

    await exec(`tar -xf ${tar} -C ${dir}`);
    log(`unpacked to ${dir}`);
    return dir;
};

/**
 *
 * @param {string} package1
 * @param {string} package2
 * @param {boolean} full
 * @param {string} exclude
 * @param {boolean} toStdOut
 *
 * @returns {Promise<boolean|string|undefined>}
 */
const compare = async (package1, package2, options = {}) => {
    const { full = true, exclude, toStdOut, hooks = {} } = options;
    if (package1 === package2) {
        throw Error(`${package1} and ${package2} are equal`);
    }
    const sessionDir = await getSessionDir(package1, package2);
    const downloadPath = await makeTempDir(sessionDir, 'download');

    const [path1, path2] = await Promise.all([
        getPackageTarPath({
            pkg: package1,
            downloadPath: downloadPath,
            options,
        }),
        getPackageTarPath({
            pkg: package2,
            downloadPath,
            firstPackage: package1,
            options,
        }),
    ]);

    // compare file structure
    const [fileList1, fileList2] = await Promise.all([
        getFilesList(path1, { exclude }),
        getFilesList(path2, { exclude }),
    ]);

    log('comparing file structure...');

    const unpackedDir1 = await unpack(path1, sessionDir);
    const unpackedDir2 = await unpack(path2, sessionDir);

    log('diffing content...');
    log('diffing content - done', 'time');

    const compareFileList = buildCompareFileList(
        unpackedDir1,
        unpackedDir2,
        fileList1,
        fileList2
    );

    let result;
    if (full) {
        result = execDiff({
            dir1: unpackedDir1,
            dir2: unpackedDir2,
            exclude,
            toStdOut,
            options,
        });
    } else {
        if (hooks.beforeAll && (await hooks.beforeAll(compareFileList)) === false) {
            return false;
        }

        result = execFastDiff({
            dir1: unpackedDir1,
            list: compareFileList,
            exclude,
            options,
        });
    }

    log('diffing content - done', 'timeEnd');

    return result;
};

module.exports = compare;
