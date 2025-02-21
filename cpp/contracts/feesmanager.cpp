#include "feesmanager.hpp"

using namespace eosio;

void feesmanager::setallowance( name node, name token, const asset& value ) {
    require_auth(get_self());

    auto balance = getbalance(token, value.symbol);

    total_allowance_table total_allowance(get_self(), token.value);
    auto total_token_allowance = total_allowance.get_or_create(get_self(), {asset(0, value.symbol)}).allowance.amount;

    allowances_table allowances(get_self(), node.value);
    auto allowance_itr = allowances.find(value.symbol.code().raw());
    auto allowance_name_idx = allowances.get_index<"name"_n>();
    auto allowance_name_itr = allowance_name_idx.find(token.value);

    if (allowance_itr == allowances.end() && allowance_name_itr == allowance_name_idx.end()) {
        check(balance.amount >= total_token_allowance + value.amount, "[set allowance]: balance is lower than the allowance to be set");
        allowances.emplace(get_self(), [&](auto& a) {
            a.node_allowance = value;
            a.token = token;
        });
        total_allowance.set({asset(total_token_allowance + value.amount , value.symbol)}, get_self());
    } else {
        check(allowance_itr->token == token, "symbol and token do not match");
        check(balance.amount >= (total_token_allowance - allowance_itr->node_allowance.amount) + value.amount, "balance is lower than the allowance to be set");
        allowances.modify(allowance_itr, get_self(), [&](auto& a) {
            a.node_allowance = value;
            a.token = token;
        });
        total_allowance.set({asset(total_token_allowance + value.amount , value.symbol)}, get_self());
    }
}

void feesmanager::incallowance( name node, name token, const asset& value ) {
    require_auth(get_self());

    allowances_table allowances(get_self(), node.value);
    const auto& allowance_table = allowances.get(value.symbol.code().raw(), "No allowance set for this node");

    total_allowance_table total_allowance(get_self(), token.value);
    auto total_token_allowance = total_allowance.get().allowance.amount;

    auto balance = getbalance(token, value.symbol);
    check(balance.amount >= total_token_allowance + value.amount, "[increase allowance]: balance is lower than the allowance to be set");

    allowances.modify(allowance_table, get_self(), [&](auto& a) {
        a.node_allowance.amount += value.amount;
    });
}

void feesmanager::withdrawto( name node, name token, symbol token_symbol ) {
    allowances_table allowances(get_self(), node.value);

    const auto& allowance_table = allowances.get(token_symbol.code().raw(), "No allowance set for this node");
    asset asset_data = asset(allowance_table.node_allowance.amount, token_symbol);

    allowances.modify(allowance_table, node, [&](auto& a) {
        a.node_allowance.amount = 0;
    });

    action_transfer _transfer(token, { get_self(), "active"_n });
    _transfer.send(get_self(), node, asset_data, std::string("Withdraw"));
}

// FIXME: multiple withdraw do not work currently
void feesmanager::withdrawmtto(name node, const std::vector<name>& tokens, const std::vector<symbol>& token_symbols) {
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