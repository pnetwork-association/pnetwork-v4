#pragma once

#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>
#include <eosio/asset.hpp>

using namespace eosio;

CONTRACT feesmanager : public eosio::contract {
public:
    using contract::contract;

    ACTION setallowance(name node, const asset& value);

    ACTION incallowance(name node, const asset& value);

    ACTION withdrawto(name node, name token, const asset& value);

    ACTION withdrawto(name node, const std::vector<name>& tokens, const std::vector<asset>& values);

private:

    TABLE allowance {
        asset allowance_data;

        uint64_t primary_key()const { return allowance_data.symbol.code().raw(); }
    };

    typedef eosio::multi_index< "allowances"_n, allowance > allowances_table;
};