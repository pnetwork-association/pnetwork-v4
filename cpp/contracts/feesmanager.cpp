#include "feesmanager.hpp"

using namespace eosio;

void feesmanager::init( name security_council ) {
    require_auth(get_self());
    print("AAAAA");
    check(is_account(security_council), "Security Council account does not exist");

    config_singleton _config(get_self(), get_self().value);
    check(!_config.exists(), "Owner is already set");
    _config.set(config{security_council}, get_self());
}

// Set allowance for a node
void feesmanager::setallowance( name node, const asset& value ) {
    print("Setting allowance for node: ", node, " with value: ", value);
    check_owner();

    allowances_table allowances(get_self(), node.value);
    auto allowance_itr = allowances.find(value.symbol.code().raw());
    
    if (allowance_itr == allowances.end()) {
        allowances.emplace(get_self(), [&](auto& a) {
            a.allowance_data = value;
        });
    } else {
        allowances.modify(allowance_itr, get_self(), [&](auto& a) {
            a.allowance_data = value;
        });
    }
}

// Increase allowance for a node
void feesmanager::incallowance( name node, const asset& value ) {
    check_owner();

    allowances_table allowances(get_self(), node.value);
    const auto& allowance_table = allowances.get(value.symbol.code().raw(), "No allowance set for this node");

    allowances.modify(allowance_table, get_self(), [&](auto& a) {
        a.allowance_data.amount += value.amount;
    });
}

// Withdraw function to withdraw tokens
void feesmanager::withdrawto( name node, const asset& token ) {
    allowances_table allowances(get_self(), node.value);
    const auto& allowance_table = allowances.get(token.symbol.code().raw(), "No allowance set for this node");
    check(allowance_table.allowance_data.amount >= 0, "Allowance is zero");

    asset asset_data = asset(allowance_table.allowance_data.amount, token.symbol);

    allowances.modify(allowance_table, node, [&](auto& a) {
        a.allowance_data.amount = 0;
    });

    action(
        permission_level{get_self(), "active"_n},
        "eosio.token"_n,
        "transfer"_n,
        std::make_tuple(get_self(), node, asset_data, std::string("Withdraw"))
    ).send();
}

void feesmanager::withdrawto(name node, const std::vector<asset>& tokens) {
    for (const auto& token : tokens) {
        withdrawto(node, token);
    }
}

void feesmanager::check_owner() {
    config_singleton _config(get_self(), get_self().value);
    check(_config.exists(), "Owner has not been set");

    config cfg = _config.get();
    require_auth(cfg.owner); 
}