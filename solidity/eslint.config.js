import config from '../eslint.config.js'

export default [
  ...config,
  { rules: { 'no-console': 'off' } },
  {
    ignores: ['**/XERC20.sol', '**/XERC20Lockbox.sol'],
  },
]
