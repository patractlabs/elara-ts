module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    plugins: [
        "@typescript-eslint",
    ],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
    ],
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        ecmaFeatures: {}
    },
    globals: {
        "BigInt64Array": "readonly",
        "BigUint64Array": "readonly",
        "__non_webpack_require__": "readonly"
    },

    // === General rules =========================================================

    rules: {
        // Omitted semicolons are hugely popular, yet within the compiler it makes
        // sense to be better safe than sorry.
        // "semi": "error",

        // Our code bases uses 4 spaces for indentation, and we enforce it here so
        // files don't mix spaces, tabs or different indentation levels.
        "indent": ["error", 4, {
            "SwitchCase": 1,
            "VariableDeclarator": "first",
            "offsetTernaryExpressions": true,
            "ignoredNodes": [ // FIXME: something's odd here
                "ConditionalExpression > *",
                "ConditionalExpression > * > *",
                "ConditionalExpression > * > * > *"
            ]
        }],

        // This is mostly visual style, making comments look uniform.
        "spaced-comment": ["error", "always", {
            "markers": ["/"], // triple-slash
            "exceptions": ["/"] // all slashes
        }],

        // This tends to be annoying as it encourages developers to make everything
        // that is never reassigned a 'const', sometimes semantically incorrect so,
        // typically leading to huge diffs in follow-up PRs modifying affected code.
        "prefer-const": "off",

        // It is perfectly fine to declare top-level variables with `var`, yet this
        // rule doesn't provide configuration options that would help.
        "no-var": "error",

        // Quite often, dealing with multiple related cases at once or otherwise
        // falling through is exactly the point of using a switch.
        "no-fallthrough": "off",

        // Typical false-positives here are `do { ... } while (true)` statements or
        // similar, but the only option provided here is not checking any loops.
        "no-constant-condition": ["error", {
            checkLoops: false
        }],

        // Functions are nested in blocks occasionally, and there haven't been any
        // problems with this so far, so turning the check off.
        "no-inner-declarations": "off",

        // Quite common in scenarios where an iteration starts at `current = this`.
        "@typescript-eslint/no-this-alias": "off",

        // Disabled here, but enabled again for JavaScript files.
        "no-unused-vars": "off",

        // Disabled here, but enabled again for TypeScript files.
        "@typescript-eslint/no-unused-vars": "off"
    },
    overrides: [

        // === JavaScript rules ====================================================

        {
            env: {
                "browser": true,
                "amd": true,
                "node": true,
                "es6": true
            },
            files: [
                "**/*.js",
                "bin/*"
            ],
            rules: {
                // We are testing both ESM and UMD, so don't limit us.
                "@typescript-eslint/no-var-requires": "off",

                // This rule does not behave well in JS files.
                "@typescript-eslint/explicit-module-boundary-types": "off",

                // Enforcing to remove function parameters on stubs makes code less
                // maintainable, so we instead allow unused function parameters.
                "no-unused-vars": [
                    "warn", {
                        "vars": "local",
                        "args": "none",
                        "ignoreRestSiblings": false
                    }
                ]
            }
        },

        // === TypeScript rules ====================================================

        {
            files: [
                "**/*.ts"
            ],
            rules: {
                // Enforcing to remove function parameters on stubs makes code less
                // maintainable, so we instead allow unused function parameters.
                "@typescript-eslint/no-unused-vars": [
                    "warn", {
                        "vars": "local",
                        "varsIgnorePattern": "^[A-Z](?:From|To)?$", // ignore type params
                        "args": "none",
                        "ignoreRestSiblings": false
                    }
                ]
            }
        },
    ]
};