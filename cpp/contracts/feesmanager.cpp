#include "feesmanager.hpp"

using namespace eosio;

// Set allowance for a node
void feesmanager::setallowance( name node, const asset& value ) {
    require_auth(get_self());
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
    require_auth(get_self());

    allowances_table allowances(get_self(), node.value);
    const auto& allowance_table = allowances.get(value.symbol.code().raw(), "No allowance set for this node");

    allowances.modify(allowance_table, get_self(), [&](auto& a) {
        a.allowance_data.amount += value.amount;
    });
}

// Withdraw function to withdraw tokens
void feesmanager::withdrawto( name node, name token, const asset& value ) {
    allowances_table allowances(get_self(), node.value);
    const auto& allowance_table = allowances.get(value.symbol.code().raw(), "No allowance set for this node");
    check(allowance_table.allowance_data.amount >= 0, "Allowance is zero");

    asset asset_data = asset(allowance_table.allowance_data.amount, value.symbol);

    allowances.modify(allowance_table, node, [&](auto& a) {
        a.allowance_data.amount = 0;
    });
   
    action(
        permission_level{get_self(), "active"_n},
        token,
        "transfer"_n,
        std::make_tuple(get_self(), node, asset_data, std::string("Withdraw"))
    ).send();
}

void feesmanager::withdrawto(name node, const std::vector<name>& tokens, const std::vector<asset>& values) {
    for (const auto& token : tokens) {
        withdrawto(node, token, values[0]);
    }
}