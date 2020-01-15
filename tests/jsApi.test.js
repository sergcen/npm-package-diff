const execa = require('execa');
const { compareJSON } = require('../src/index');

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
        { full: true, exclude: '*.md' }
    );

    expect(result.length).toBe(2);
});

test('compare tgz files as fast check', async () => {
    const result = await compareJSON(
        './tests/fixtures/pkg1.tgz',
        './tests/fixtures/pkg2.tgz',
        { full: false, exclude: '*.md' }
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
