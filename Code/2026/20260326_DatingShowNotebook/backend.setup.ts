import path from 'path';
process.env.DSN_RESTRICTED_ROOT = path.resolve('./test-work/data');
process.env.DSN_WORK_FOLDER = path.resolve('./test-work');
process.env.NODE_ENV = 'test';
