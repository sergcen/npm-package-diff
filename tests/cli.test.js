const execa = require('execa');

const exec = async (cmd) => {
    let res;
    try {
        res = await execa('sh', ['-c', cmd]);
    } catch(e) {
        res = e;
    }

    return res;
};

test('compare tar gz files', async() => {
    const { stdout, code } = await exec('./bin/pkdiff ./tests/fixtures/pkg1.tgz ./tests/fixtures/pkg2.tgz -q -f json');

    expect(code).toBe(1);
    expect(JSON.parse(stdout).length).toBe(3);
});

test('compare tar gz files ignore exit-code', async() => {
    const { stdout, code } = await exec('./bin/pkdiff ./tests/fixtures/pkg1.tgz ./tests/fixtures/pkg2.tgz -q -c -f json');

    expect(code).toBe(0);
    expect(JSON.parse(stdout).length).toBe(3);
});

test('compare tar gz files with exclude md files', async() => {
    const { stdout, code } = await exec(
        './bin/pkdiff ./tests/fixtures/pkg1.tgz ./tests/fixtures/pkg2.tgz -q -f json --exclude=\'\\.md$\''
    );

    expect(code).toBe(1);
    expect(JSON.parse(stdout).length).toBe(2);
});

test('equals tar gz files', async() => {
    const { stdout, code } = await exec(
        './bin/pkdiff ./tests/fixtures/pkg1.tgz ./tests/fixtures/pkg1-copy.tgz --fast-check -q -f json --exclude=\'\\.md$\''
    );

    expect(code).toBe(0);
    expect(stdout).toBe('');
});
