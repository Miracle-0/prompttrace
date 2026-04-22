import { Command } from 'commander';

const program = new Command();
program
  .name('prompttrace')
  .description('Share your AI coding sessions on GitHub')
  .version('0.1.0');

program.parse();
