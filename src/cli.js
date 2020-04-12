const path = require('path');
const program = require('commander');
const open = require('open');

const pkg = require('../package');
const compare = require('./compare');

const {
    saveToFile,
    formatOutput,
    log,
    makeTempDir,
    getSessionDir,
} = require('./utils');

program
    .arguments('<new-package> <old-package>')
    .description(pkg.description)
    .option('-x, --exclude [glob]', 'exclude files to diff (unix diff exclude)')
    .option('-f, --format [diff|json|html]', 'output format', 'html')
    .option('-o, --output [path]', 'output destination', false)
    .option('-c, --no-exit-code', 'returns code 0 if found differences', false)
    .option('-q, --quite', 'turn off actions log', false)
    .option('--no-open', 'no open in browser', false)
    .option('--registry [url]', 'npm registry')
    .option('--prefer-offline', 'npm --prefer-offline option', true)
    .option(
        '--fast-check',
        'will try to find first diff and return result',
        false,
    )
    .version(pkg.version, '-v, --version')
    .action(
        async (
            newPkg,
            oldPkg,
            {
                exclude,
                fastCheck,
                output: outputFilepath,
                format,
                exitCode,
                quite,
                registry,
                preferOffline,
                open: openInBrowser
            }
        ) => {
            log.quite = quite;

            if (!outputFilepath && format === 'html') {
                const sessionDir = await getSessionDir(newPkg, oldPkg);

                outputFilepath = path.join(
                    await makeTempDir(sessionDir, 'report'),
                    'report.html',
                );
            }

            const diffOutput = await compare(newPkg, oldPkg, {
                exclude,
                full: !fastCheck,
                // diff pipes to stdout if doesn't exists "output" option
                toStdOut: format === 'diff' && !outputFilepath,
                registry,
                preferOffline,
            }).catch(e => {
                console.error(e);
                process.exit(2);
            });

            const hasDiff = fastCheck ? !diffOutput : Boolean(diffOutput);

            log(
                hasDiff
                    ? 'Packages are different'
                    : 'Packages are equal',
            );

            if (!fastCheck) {
                const formattedDiff = formatOutput(diffOutput, format);

                if (outputFilepath) {
                    const savedPath = saveToFile(outputFilepath, formattedDiff);

                    if (hasDiff && format === 'html' && openInBrowser) {
                        await open(savedPath);
                    }
                } else {
                    format !== 'diff' &&
                        process.stdout.write('\n' + formattedDiff);
                }
            }

            exitCode && process.exit(hasDiff ? 1 : 0);
        },
    );

program.parse(process.argv);
