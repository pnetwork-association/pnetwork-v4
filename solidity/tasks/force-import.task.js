const {
  TASK_NAME_FORCE_IMPORT,
  TASK_DESC_FORCE_IMPORT,
  TASK_PARAM_CONTRACT_FACTORY,
  TASK_PARAM_DESC_CONTRACT_FACTORY,
  TASK_PARAM_PROXY_ADDRESS,
  TASK_PARAM_DESC_PROXY_ADDRESS,
} = require('./constants.js')

const forceImport = (_taskArgs, _hre) =>
  console.info('Forcing import for contract...') ||
  _hre.ethers
    .getContractFactory(_taskArgs[TASK_PARAM_CONTRACT_FACTORY])
    .then(_contractFactory =>
      _hre.upgrades.forceImport(
        _taskArgs[TASK_PARAM_PROXY_ADDRESS],
        _contractFactory,
      ),
    )
    .then(_ => console.info('Imported successfully!'))

task(TASK_NAME_FORCE_IMPORT, TASK_DESC_FORCE_IMPORT, forceImport)
  .addPositionalParam(
    TASK_PARAM_PROXY_ADDRESS,
    TASK_PARAM_DESC_PROXY_ADDRESS,
    undefined,
    types.string,
  )
  .addPositionalParam(
    TASK_PARAM_CONTRACT_FACTORY,
    TASK_PARAM_DESC_CONTRACT_FACTORY,
    undefined,
    types.string,
  )
