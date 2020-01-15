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
    .option('-c, --no-exit-code', 'returns code 0 if found differences')
    .option('-q, --quite', 'turn off actions log', false)
    .option(
        '--fast-check',
        'will try to find first diff and return result',
        false,
    )
    .action(
        async (
            pkg1,
            pkg2,
            {
                exclude,
                fastCheck,
                output: outputFilepath,
                format,
                noExitCode,
                quite,
            },
        ) => {
            log.quite = quite;

            if (!outputFilepath && format === 'html') {
                const sessionDir = await getSessionDir(pkg1, pkg2);

                outputFilepath = path.join(
                    await makeTempDir(sessionDir, 'report'),
                    'report.html',
                );
            }

            const diffOutput = await compare(pkg1, pkg2, {
                exclude,
                full: !fastCheck,
                // diff pipes to stdout if doesn't exists "output" option
                toStdOut: format === 'diff' && !outputFilepath,
            }).catch(e => {
                console.error(e);
                process.exit(2);
            });

            if (fastCheck) {
                log(
                    !diffOutput
                        ? 'Packages are different'
                        : 'Packages are equal',
                );
            }
            if (!fastCheck) {
                const formattedDiff = formatOutput(diffOutput, format);

                if (outputFilepath) {
                    const savedPath = saveToFile(outputFilepath, formattedDiff);

                    if (format === 'html') {
                        await open(savedPath);
                    }
                } else {
                    format !== 'diff' &&
                        process.stdout.write('\n' + formattedDiff);
                }
            }

            !noExitCode && process.exit(!diffOutput ? 1 : 0);
        },
    );

program.parse(process.argv);
