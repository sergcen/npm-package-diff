const path = require('path');
const os = require('os');
const execa = require('execa');
const fs = require('fs');
const { promisify } = require('util');

const fsStat = promisify(fs.stat);
const npa = require('npm-package-arg');

const { log, makeTempDir, getSessionDir } = require('./utils');

const execDiff = async ({ list, toStdOut = false }) => {
    const input = list.map(p => p.join(' ')).join(' ');
    const cpuCount = os.cpus().length;

    const cmd = execa(
        'xargs',
        [
            '-n2',
            `-P ${cpuCount}`,
            'sh',
            '-c',
            `diff --new-file --unified $0 $1 || exit 0`,
        ],
        {
            stdio: toStdOut ? 'inherit' : undefined,
            input
        },
    );
    const { stdout } = await cmd;

    return stdout;
};

const execFastDiff = async args => {
    const {
        dir1,
        list,
        options: { validate },
    } = args;

    if (list.length === 0) return true;

    const input = list.map(p => p.join(' ')).join(' ');

    const cmd = execa(
        'xargs',
        [
            '-n2',
            'sh',
            '-c',
            `diff --new-file -q $0 $1 || exit 255`,
        ],
        { input },
    );
    // by default has diff
    let result = false;

    try {
        await cmd;

        result = true;
    } catch (e) {
        const { stdout } = e;

        // last line in stdout is filepath with diff
        const start = stdout.lastIndexOf(dir1);
        const end = stdout.indexOf(' ', start);
        const filepath = stdout.slice(start, end);
        const failedItemIndex = list.findIndex(([_, path2]) => path2 === filepath);

        if (validate) {
            const validateResult = await validate(...list[failedItemIndex]);

            if (validateResult) {
                // if hook function decided skip this file
                // continue from skipped
                result = await execFastDiff({
                    ...args,
                    list: list.slice(failedItemIndex + 1),
                });
            }
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
        files = files.filter(file => !exclude.test(file));
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

const getRegistry = async () => {
    const { stdout } = await execa('npm', ['config', 'get', 'registry']);

    return stdout.trim();
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
    ).catch(() => {
        throw Error(
            `Download failed: ${fetchName} from registry: ${options.registry}`,
        );
    });
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
 * @param {string} newPkg
 * @param {string} oldPkg
 * @param {Object} options - comparison options
 * @param {boolean} options.full=true
 * @param {string} options.exclude
 * @param {boolean} options.toStdOut
 *
 * @returns {Promise<boolean|string|undefined>}
 */
const compare = async (newPkg, oldPkg, options = {}) => {
    const { full = true, exclude, toStdOut } = options;
    if (newPkg === oldPkg) {
        throw Error(`${newPkg} and ${oldPkg} are equal`);
    }
    const sessionDir = await getSessionDir(newPkg, oldPkg);
    const downloadPath = await makeTempDir(sessionDir, 'download');

    if (!options.registry) {
        options.registry = await getRegistry();
    }

    const [newPkgPath, oldPkgPath] = await Promise.all([
        getPackageTarPath({
            pkg: newPkg,
            downloadPath: downloadPath,
            options,
        }),
        getPackageTarPath({
            pkg: oldPkg,
            downloadPath,
            firstPackage: newPkg,
            options,
        }),
    ]);

    const excludeRegExp = typeof exclude === 'string' ?
        new RegExp(exclude) :
        exclude;

    // compare file structure
    const [newPkgList, oldPkgList] = await Promise.all([
        getFilesList(newPkgPath, { exclude: excludeRegExp }),
        getFilesList(oldPkgPath, { exclude: excludeRegExp }),
    ]);

    log('comparing file structure...');

    const unpackedNewDir1 = await unpack(newPkgPath, sessionDir);
    const unpackedOldDir2 = await unpack(oldPkgPath, sessionDir);

    log('diffing content...');
    log('diffing content - done', 'time');

    const compareFileList = buildCompareFileList(
        unpackedOldDir2,
        unpackedNewDir1,
        oldPkgList,
        newPkgList,
    );

    let result;
    if (full) {
        result = execDiff({
            dir1: unpackedNewDir1,
            dir2: unpackedOldDir2,
            list: compareFileList,
            toStdOut,
            options,
        });
    } else {
        result = execFastDiff({
            dir1: unpackedNewDir1,
            list: compareFileList,
            options,
        });
    }

    log('diffing content - done', 'timeEnd');

    return result;
};

module.exports = compare;
