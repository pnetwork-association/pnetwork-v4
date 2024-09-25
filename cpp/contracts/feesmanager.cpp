#include "feesmanager.hpp"

using namespace eosio;

// Define the `account` struct to access `eosio.token` balances table
struct [[eosio::table, eosio::contract("eosio.token")]] account {
    asset balance;
    uint64_t primary_key() const { return balance.symbol.code().raw(); }
};

typedef eosio::multi_index<"accounts"_n, account> accounts;

// Set allowance for a node
void feesmanager::setallowance( name node, name token, uint64_t amount ) {
    require_auth(get_self());

    allowances_table allowances(get_self(), get_self().value);
    auto allowance_itr = allowances.find(node.value + token.value);
    
    if (allowance_itr == allowances.end()) {
        allowances.emplace(get_self(), [&](auto& row) {
            row.node = node;
            row.token = token;
            row.amount = amount;
        });
    } else {
        allowances.modify(allowance_itr, get_self(), [&](auto& row) {
            row.amount = amount;
        });
    }
}

// Increase allowance for a node
void feesmanager::incallowance( name node, name token, uint64_t amount ) {
    require_auth(get_self());

    allowances_table allowances(get_self(), get_self().value);
    auto allowance_itr = allowances.find(node.value + token.value);
    check(allowance_itr != allowances.end(), "No allowance set for this node");

    allowances.modify(allowance_itr, get_self(), [&](auto& row) {
        row.amount += amount;
    });
}

// Withdraw function to withdraw tokens
void feesmanager::withdrawto( name node, name token ) {
    require_auth(get_self());

    allowances_table allowances(get_self(), get_self().value);
    auto allowance_itr = allowances.find(node.value);
    check(allowance_itr != allowances.end(), "No allowance set for this node");
    check(allowance_itr->amount >= 0, "Allowance is zero");

    allowances.modify(allowance_itr, node, [&](auto& row) {
        row.amount = 0;
    });

    action(
        permission_level{get_self(), "active"_n},
        token,
        "transfer"_n,
        std::make_tuple(get_self(), node, allowance_itr->amount, std::string("Withdraw"))
    ).send();
}

void feesmanager::withdrawto(name node, const std::vector<name>& tokens) {
    require_auth(get_self());

    for (const auto& token : tokens) {
        withdrawto(node, token);
    }
}