# NPM package diff (pkdiff)

Package to show diff between package versions.

Requirements:
GNU diffutils (diff)

Usage:

`npm install -g pkdiff`

`pkdiff <new-package> <old-package>`

### Basic examples:

show diff in browser:

`npx pkdiff react@latest 16.11.0` (name can be without tag `latest`)

diff as JSON:

`npx pkdiff react@16.12.0 16.11.0 --format=json > diff.json`

diff as unix Diff:

`npx pkdiff react@16.12.0 16.11.0 -f diff`

exclude files from diff:

`npx pkdiff react@latest 16.11.0 --exclude='*.json'`

### Compare local packed packages:

-   `npx pkdiff your-package@latest ./your-packed-package.tgz`
-   `npx pkdiff ./your-packed-package1.tgz ./your-packed-package2.tgz`

#### Output formats:

-   json
-   html ([see Diff2html example](https://github.com/rtfpessoa/diff2html#online-example))
-   diff (UNIX diff output)

#### Options

-   `-x, --exclude [glob]` - exclude files to diff (unix diff exclude)
-   `-f, --format [diff|json|html]` - output format (default: "html")
-   `-o, --output [path]` - output destination (default: false)
-   `-c, --no-exit-code` - returns code 0 if found differences
-   `-q, --quite` - turn off actions log (default: false)
-   `--fast-check` - will try to find diff in any file and return result (default: false)
-   `-h, --help` - output usage information


### JS API
```js
const { 
    // result as JSON
    compareJSON,
    // result as "unix diff" string
    compare,
    // if you don't logs set it to false
    setLogQuite
} = require('pkdiff');

/**
 * @param {string} package1 - new package
 * @param {string} package2 - old package (can be as version or tag)
 * @param {Object} options - comparison options
 * @param {boolean} options.full=true - flag for full check, 
   if "false" compare function will stop on first diff and returns boolean (package equals: true or has diff: false)
 * @param {string} options.exclude - exclude glob for unix "diff"
 * @param {boolean} options.toStdOut - all diff output to stdOut
 *
 * @returns {Promise<boolean|string|undefined>}
*/


//examples
const hasDiff = compare('pkg1@1.0.0', '0.9.0', { full: false });
const diffJSON = compareJSON('pkg1@1.0.0', '0.9.0');

const changedFiles = diffJSON.map(...)

```
