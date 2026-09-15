#!/usr/bin/env node

const { createCli } = require('../src/cli');

const cli = createCli();
cli.parse(process.argv);
