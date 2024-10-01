#include "feesmanager.hpp"

using namespace eosio;

void feesmanager::setallowance( name node, name token, const asset& value ) {
    require_auth(get_self());

    auto balance = getbalance(token, value.symbol);
    check(balance.amount >= value.amount, "balance is lower than the allowance to be set");

    allowances_table allowances(get_self(), node.value);
    auto allowance_itr = allowances.find(value.symbol.code().raw());
    auto allowance_name_idx = allowances.get_index<"name"_n>();
    auto allowance_name_itr = allowance_name_idx.find(token.value);

    if (allowance_itr == allowances.end() && allowance_name_itr == allowance_name_idx.end()) {
        allowances.emplace(get_self(), [&](auto& a) {
            a.allowance_data = value;
            a.token = token;
        });
    } else {
        check(allowance_itr->token == token, "symbol and token do not match");
        allowances.modify(allowance_itr, get_self(), [&](auto& a) {
            a.allowance_data = value;
        });
    }
}

void feesmanager::incallowance( name node, name token, const asset& value ) {
    require_auth(get_self());

    allowances_table allowances(get_self(), node.value);
    const auto& allowance_table = allowances.get(value.symbol.code().raw(), "No allowance set for this node");

    auto balance = getbalance(token, value.symbol);
    check(balance.amount >= value.amount + allowance_table.allowance_data.amount, "balance is lower than the allowance to be set");

    allowances.modify(allowance_table, get_self(), [&](auto& a) {
        a.allowance_data.amount += value.amount;
    });
}

void feesmanager::withdrawto( name node, name token, symbol token_symbol ) {
    allowances_table allowances(get_self(), node.value);

    const auto& allowance_table = allowances.get(token_symbol.code().raw(), "No allowance set for this node");
    asset asset_data = asset(allowance_table.allowance_data.amount, token_symbol);

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

void feesmanager::withdrawto(name node, const std::vector<name>& tokens, const std::vector<symbol>& token_symbols) {
    check(tokens.size() == token_symbols.size(), "Token names and symbol size mismatch");
    for (size_t i = 0; i < tokens.size(); ++i) {
        withdrawto(node, tokens[i], token_symbols[i]);
    }
}

asset feesmanager::getbalance(name token, symbol token_symbol) {
    accounts accountstable(token, get_self().value);
    auto it = accountstable.find(token_symbol.code().raw());
    if (it != accountstable.end()) {
        return it->balance;
    } else {
        return asset(0, token_symbol);
    }
}