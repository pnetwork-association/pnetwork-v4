#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

namespace eosio {
   struct [[eosio::table]] token_stats_table {
      asset    supply;
      asset    max_supply;
      name     issuer;

      uint64_t primary_key()const { return supply.symbol.code().raw(); }
   };
}