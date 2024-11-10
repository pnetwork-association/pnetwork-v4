#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include <eosio/singleton.hpp>

#include <string>

#include "xerc20.token.hpp"
#include "tables/token_stats.table.hpp"
#include "tables/lockbox_registry.table.hpp"

namespace eosio {
   using std::string;

   class [[eosio::contract("lockbox")]] lockbox : public contract {
      public:
         using contract::contract;

         ACTION create(
            const name& xerc20,
            const symbol& xerc20_symbol,
            const name& token,
            const symbol& token_symbol
         );

         [[eosio::on_notify("*::transfer")]]
         void ontransfer(const name& from, const name& to, const asset& quantity, const string& memo);

         [[eosio::on_notify("*::mint")]]
         void onmint(const name& from, const name& to, const asset& quantity, const string& memo);

         using action_burn = action_wrapper<"burn"_n, &xtoken::burn>;
         using action_mint = action_wrapper<"mint"_n, &xtoken::mint>;
         using action_transfer = action_wrapper<"transfer"_n, &xtoken::transfer>;
      private:
         typedef eosio::multi_index<"stat"_n, token_stats_table > stats;
         typedef eosio::multi_index<
            "reglockbox"_n,
            lockbox_registry_table,
            lockbox_registry_byxtoken
         > registry;

         void check_symbol_is_valid(const name& account, const symbol& sym);
   };
}