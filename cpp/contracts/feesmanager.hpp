#pragma once

#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>
#include <eosio/asset.hpp>

using namespace eosio;

CONTRACT feesmanager : public eosio::contract {
public:
    using contract::contract;

    ACTION init(name security_council);

    ACTION setallowance(name node, const asset& value);

    ACTION incallowance(name node, const asset& value);

    ACTION withdrawto(name node, const asset& token);

    ACTION withdrawto(name node, const std::vector<asset>& tokens);

private:
    TABLE config {
        name owner;
    };

    TABLE allowance {
        asset allowance_data;

        uint64_t primary_key()const { return allowance_data.symbol.code().raw(); }
    };

    typedef eosio::singleton<"config"_n, config> config_singleton;
    typedef eosio::multi_index< "allowances"_n, allowance > allowances_table;

    void check_owner();
};