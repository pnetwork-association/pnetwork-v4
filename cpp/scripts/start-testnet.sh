#!/bin/bash
dir_name=$(dirname $(realpath $BASH_SOURCE))

source "$dir_name/constants.sh"
source "$dir_name/utils.sh"
source "$dir_name/start-nodeos.sh"
source "$dir_name/create-wallet.sh"

set -e

# Folder data is defined inside utils.sh
dir_data=$dir_name/$FOLDER_EOS_DATA

echo "Starting nodeos..."

abort_if_nodeos_in_background

mkdir -p $dir_data

start_nodeos

echo "nodeos started..."

sleep 5

echo "activating protocol features..."
# PREACTIVATE_FEATURE
curl --request POST \
    --url http://127.0.0.1:8888/v1/producer/schedule_protocol_feature_activations \
    -d '{"protocol_features_to_activate": ["0ec7e080177b2c02b278d5088611686b49d739925a92d9bfcacd7fc6b74053bd"]}'

sleep 3

echo "Creating local wallet..."

# Create wallet
# cleos wallet create -n local -f $path_wallet/local.wallet
create_wallet "local"

# Import eosio private key
# NOTE: bootstrap private key related to the eosio account
# reference https://developers.eos.io/welcome/latest/tutorials/tic-tac-toe-game-smart-contract-single-node/#procedure-for-accounts
pk=5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3
output=$(cleos wallet import -n local --private-key "$pk")

echo "Installing eosio.boot"
# Install eosio.boot
cleos set contract eosio ./resources/eosio.boot/ eosio.boot.wasm eosio.boot.abi

echo "Pushing actions..."

# Activate other features
cleos push action eosio activate '["c3a6138c5061cf291310887c0b5c71fcaffeab90d5deb50d3b9e687cead45071"]' -p eosio 1> /dev/null
cleos push action eosio activate '["5443fcf88330c586bc0e5f3dee10e7f63c76c00249c87fe4fbf7f38c082006b4"]' -p eosio 1> /dev/null
cleos push action eosio activate '["f0af56d2c5a48d60a4a5b5c903edfb7db3a736a94ed589d0b797df33ff9d3e1d"]' -p eosio 1> /dev/null
cleos push action eosio activate '["2652f5f96006294109b3dd0bbde63693f55324af452b799ee137a81a905eed25"]' -p eosio 1> /dev/null
cleos push action eosio activate '["8ba52fe7a3956c5cd3a656a3174b931d3bb2abb45578befc59f283ecd816a405"]' -p eosio 1> /dev/null
cleos push action eosio activate '["ad9e3d8f650687709fd68f4b90b41f7d825a365b02c23a636cef88ac2ac00c43"]' -p eosio 1> /dev/null
cleos push action eosio activate '["68dcaa34c0517d19666e6b33add67351d8c5f69e999ca1e37931bc410a297428"]' -p eosio 1> /dev/null
cleos push action eosio activate '["e0fb64b1085cc5538970158d05a009c24e276fb94e1a0bf6a528b48fbc4ff526"]' -p eosio 1> /dev/null
cleos push action eosio activate '["ef43112c6543b88db2283a2e077278c315ae2c84719a8b25f25cc88565fbea99"]' -p eosio 1> /dev/null
cleos push action eosio activate '["4a90c00d55454dc5b059055ca213579c6ea856967712a56017487886a4d4cc0f"]' -p eosio 1> /dev/null
cleos push action eosio activate '["1a99a59d87e06e09ec5b028a9cbb7749b4a5ad8819004365d02dc4379a8b7241"]' -p eosio 1> /dev/null
cleos push action eosio activate '["4e7bf348da00a945489b2a681749eb56f5de00b900014e137ddae39f48f69d67"]' -p eosio 1> /dev/null
cleos push action eosio activate '["4fca8bd82bbd181e714e283f83e1b45d95ca5af40fb89ad3977b653c448f78c2"]' -p eosio 1> /dev/null
cleos push action eosio activate '["299dcb6af692324b899b39f16d5a530a33062804e41f09dc97e9f156b4476707"]' -p eosio 1> /dev/null

# Create testnet wallets
create_wallet "evil.account"
create_wallet "user.account"

echo "Done!"