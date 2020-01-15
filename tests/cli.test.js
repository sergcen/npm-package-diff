const execa = require('execa');

const exec = async (cmd) => {
    return (await execa('sh', ['-c', cmd])).stdout;
};

test('compare tar gz files', async() => {
    const stdout = await exec('./bin/pkdiff ./tests/fixtures/pkg1.tgz ./tests/fixtures/pkg2.tgz -c -q -f json');

    expect(JSON.parse(stdout).length).toBe(3);
});

test('compare tar gz files with exclude md files', async() => {
    const stdout = await exec(
        './bin/pkdiff ./tests/fixtures/pkg1.tgz ./tests/fixtures/pkg2.tgz -c -q -f json --exclude=\'*.md\''
    );

    expect(JSON.parse(stdout).length).toBe(2);
});

test('equals tar gz files', async() => {
    const stdout = await exec(
        './bin/pkdiff ./tests/fixtures/pkg1.tgz ./tests/fixtures/pkg1-copy.tgz --fast-check -q -f json --exclude=\'*.md\''
    );

    expect(stdout).toBe('');
});
