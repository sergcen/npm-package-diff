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

const execFastDiff = async ({ dir1, dir2, list, exclude }) => {
    const input = list
        .map(p => path.join(dir1, p) + ' ' + path.join(dir2, p))
        .join(' ');
    const excludeParam = exclude ? '--exclude=' + exclude : '';

    const cmd = execa(
        'xargs',
        ['-n2', 'sh', '-c', `diff ${excludeParam} -q $0 $1 || exit 255`],
        { input },
    );

    try {
        await cmd;

        return true;
    } catch (e) {
        return false;
    }
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

const getPackageTarPath = async ({ pkg, downloadPath, firstPackage }) => {
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

    log(`${fetchName}: downloading tar file...`);
    const result = await exec(`npm pack ${fetchName}`, { cwd: downloadPath });
    log(`${fetchName}: done`);

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
 * @param {Object} options - comparison options
 * @param {boolean} options.full=true
 * @param {string} options.exclude
 * @param {boolean} options.toStdOut
 *
 * @returns {Promise<boolean|string|undefined>}
 */
const compare = async (
    package1,
    package2,
    { full = true, exclude, toStdOut } = {},
) => {
    if (package1 === package2) {
        throw Error(`${package1} and ${package2} are equal`);
    }
    const sessionDir = await getSessionDir(package1, package2);
    const downloadPath = await makeTempDir(sessionDir, 'download');

    const [path1, path2] = await Promise.all([
        getPackageTarPath({ pkg: package1, downloadPath: downloadPath }),
        getPackageTarPath({
            pkg: package2,
            downloadPath,
            firstPackage: package1,
        }),
    ]);

    // compare file stuctureexecFastDiff
    const [fileList1, fileList2] = await Promise.all([
        getFilesList(path1, { exclude }),
        getFilesList(path2, { exclude }),
    ]);

    const fileStructuresDiff = listDiff(fileList1, fileList2);
    if (fileStructuresDiff.diffCount > 0) {
        if (!full) {
            return false;
        }
    }

    const unpackedDir1 = await unpack(path1, sessionDir);
    const unpackedDir2 = await unpack(path2, sessionDir);

    log('diffing content...', 'time');

    let result;
    if (full) {
        result = execDiff({
            dir1: unpackedDir1,
            dir2: unpackedDir2,
            exclude,
            toStdOut,
        });
    } else {
        result = execFastDiff({
            dir1: unpackedDir1,
            dir2: unpackedDir2,
            list: fileList1,
            exclude,
        });
    }

    log('diffing content...', 'timeEnd');

    return result;
};

module.exports = compare;
