#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>

using namespace eosio;

CONTRACT feesmanager : public eosio::contract {
public:
    using contract::contract;

    ACTION init( name security_council );

    ACTION setallowance( name node, name token, uint64_t amount );

    ACTION incallowance( name node, name token, uint64_t amount );

    ACTION withdrawto( name node, name token );

    ACTION withdrawto( name node, const std::vector<name>& tokens);

private:
    TABLE allowance {
        name node;
        name token;
        uint64_t amount;

        uint64_t primary_key() const { return node.value + token.value; }
        
        uint64_t by_token() const { return token.value; }
    };

    typedef eosio::multi_index<"allowances"_n, allowance,
        indexed_by<"bytoken"_n, const_mem_fun<allowance, uint64_t, &allowance::by_token>>
    > allowances_table;

};