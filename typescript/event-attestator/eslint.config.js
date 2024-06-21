import config from '../../eslint.config.js'

export default [
  ...config,
  {
    // files: ['**/*.js', '**/*.ts'],
    ignores: ['**/dist'],
  },
]
