#pragma once

#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>
#include <eosio/asset.hpp>

using namespace eosio;

CONTRACT feesmanager : public eosio::contract {
public:
    using contract::contract;

    ACTION setallowance(name node, name token, const asset& value);

    ACTION incallowance(name node, name token, const asset& value);

    ACTION withdrawto(name node, name token, symbol token_symbol);

    ACTION withdrawto(name node, const std::vector<name>& tokens, const std::vector<symbol>& token_symbols);

    [[eosio::action]]
    asset getbalance(name token, symbol token_symbol);

private:
    TABLE account {
        asset balance;

        uint64_t primary_key()const { return balance.symbol.code().raw(); }
    };

    TABLE allowance {
        asset allowance_data;
        name token;

        uint64_t primary_key()const { return allowance_data.symbol.code().raw(); }
        uint64_t get_name()const { return token.value; }
    };

    typedef eosio::multi_index<"accounts"_n, account> accounts;
    typedef eosio::multi_index<"allowances"_n, allowance, eosio::indexed_by<"name"_n, eosio::const_mem_fun<allowance, uint64_t, &allowance::get_name>>> allowances_table;
};