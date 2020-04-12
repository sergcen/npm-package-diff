const execa = require('execa');
const { compareJSON, hasDiff } = require('../src/index');

const exec = async cmd => {
    return (await execa('sh', ['-c', cmd])).stdout;
};

test('compare tar gz files by full diff', async () => {
    const result = await compareJSON(
        './tests/fixtures/pkg1.tgz',
        './tests/fixtures/pkg2.tgz',
        { full: true }
    );

    expect(result.length).toBe(3);
});

test('compare tar gz files with exclude md files', async () => {
    const result = await compareJSON(
        './tests/fixtures/pkg1.tgz',
        './tests/fixtures/pkg2.tgz',
        { full: true, exclude: '\\.md$' }
    );

    expect(result.length).toBe(2);
});

test('compare tgz files as fast check', async () => {
    const result = await compareJSON(
        './tests/fixtures/pkg1.tgz',
        './tests/fixtures/pkg2.tgz',
        { full: false, exclude: '\\.md$' }
    );

    expect(result).toBe(false);
});

test('equals tgz files as fast check', async () => {
    const result = await compareJSON(
        './tests/fixtures/pkg1.tgz',
        './tests/fixtures/pkg1-copy.tgz',
        { full: false }
    );

    expect(result).toBe(true);
});

test('diff tgz files as fast check with hooks', async () => {
    let lastFailed = '';

    const validate = (path1, path2) => {
        if (path2.slice(-9) === 'pkg2.json') {
            return true;
        }

        lastFailed = path2.slice(-9); // 'pgk1.json'

        return path1.includes('help.md');
    };

    await hasDiff(
        './tests/fixtures/pkg1.tgz',
        './tests/fixtures/pkg2.tgz',
        { validate }
    );

    expect(lastFailed).toBe('pkg1.json');
});
