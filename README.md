# NPM package diff (pkdiff)

Package to show diff between package versions.

Requirements:
- node > 8.6.0
- GNU diffutils (diff)
- xargs

Usage:

`npm install -g pkdiff`

`pkdiff <new-version> <old-version>`

### Basic examples:

show diff in browser:

`npx pkdiff react 16.11.0`

`npx pkdiff react@next 16.11.0`

diff as JSON:

`npx pkdiff react@16.12.0 16.11.0 --quite --format=json > diff.json`

diff as unix Diff:

`npx pkdiff react@16.12.0 16.11.0 -f diff`

exclude files from diff:

`npx pkdiff react@latest 16.11.0 --exclude='\.json$'`

### Compare local packed packages:

-   `npx pkdiff your-package@latest ./your-packed-package.tgz`
-   `npx pkdiff ./your-packed-package1.tgz ./your-packed-package2.tgz`

#### Output formats:

-   json
-   html ([see Diff2html example](https://github.com/rtfpessoa/diff2html#online-example))
-   diff (UNIX diff output)

#### Options

-   `-x, --exclude [string]` - exclude files (JS RegExp)
-   `-f, --format [diff|json|html]` - output format (default: "html")
-   `-o, --output [path]` - output destination (default: false)
-   `-c, --no-exit-code` - returns code 0 if found differences
-   `-q, --quite` - turn off actions log (default: false)
-   `--fast-check` - will try to find diff in any file and return result (default: false)
-   `--registry [string]` - npm registry url
-   `--prefer` - will try to find diff in any file and return result (default: false)
-   `-h, --help` - output usage information


### JS API
```js
const {
    hasDiff,
    // result as "unix diff" string
    // if you don't logs set it to false
    compare,
    // diff as json
    compareJSON,
    setLogQuite
} = require('pkdiff');

/**
 * @param {string} package1 - new package
 * @param {string} package2 - old package (can be as version or tag)
 * @param {Object} options - comparison options
 * @param {boolean} options.full=true - flag for full check,
   if "false" compare function will stop on first diff and returns boolean (package equals: true or has diff: false)
 * @param {function} options.validate - call validate diff function if found diff
 * @param {string|RegExp} options.exclude - JS RegExp
 * @param {boolean} options.toStdOut - all diff output to stdOut
 *
 * @returns {Promise<boolean|string|undefined>}
*/


// check diff between package versions
const result = hasDiff('react', '16.8.0', { exclude: 'package\\.json$' });
const result = hasDiff('react', '16.8.0', { exclude: '\\.(md|json)$' });

// with validate function
const result = hasDiff('pkg1@1.0.0', '0.9.0', {
  // will call validate function after found diff in this file
  validate: (newVersionFilePath, oldVersionFilePath) => {
    if (newVersionFilePath.include('/package.json')) {
      const newPkgJSON = require(newVersionFilePath);
      const oldPkgJSON = require(oldVersionFilepath);

      return assert.deepEqual(newPkgJSON.dependecies, oldPkgJSON.dependecies);
    }

    // if isn't package.json
    return false;
  }
});

// get diff as JSON
const diffJSON = compareJSON('pkg1@1.0.0', '0.9.0');

const changedFiles = diffJSON.map(fileDiff => {
  return {
    newVersion: fileDiff.newName,
    oldVersion: fileDiff.oldName
  }
})

```
