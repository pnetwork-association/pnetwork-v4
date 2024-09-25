#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include <eosio/singleton.hpp>

#include <string>

namespace eosio {
   using std::string;

   class [[eosio::contract("fees.manager")]] lockbox : public contract {
      public:
         using contract::contract;

         [[eosio::action]]
         void create(const name& securityCouncil);

         [[eosio::action]]
         void increaseAllowance(const name& caller, const name& node, const name& token, const asset& quantity);

         [[eosio::action]]
         void setAllowance(const name& caller, const name& node, const name& token, const asset& quantity);

         [[eosio::action]]
         void withdraw(const name& token);

         [[eosio::on_notify("*::transfer")]]
         void ontransfer(const name& from, const name& to, const asset& quantity, const string& memo);

      private:
         struct [[eosio::table]] registry_model {
            // NOTE: EVM XERC20Lockbox contract includes
            // a isNative boolean in the storage marking
            // if the relative xERC20 wraps the native currency.
            // Here we don't need that since there isn't such
            // distintion on EOS.
            // NOTE: we need the relative symbol info for each pair
            // element since the account name alone does not identify the
            // token.
            name     token;
            symbol   token_symbol;
            name     xerc20;
            symbol   xerc20_symbol;

            uint64_t primary_key() const { return token.value; }
            uint64_t secondary_key() const { return xerc20.value; }
         };

         // Needed to access the token/XERC20 symbols table
         struct [[eosio::table]] currency_stats {
            asset    supply;
            asset    max_supply;
            name     issuer;

            uint64_t primary_key()const { return supply.symbol.code().raw(); }
         };

         typedef eosio::multi_index< "stat"_n, currency_stats > stats;
         typedef eosio::multi_index<"registry"_n, registry_model,
            indexed_by< "byxtoken"_n, const_mem_fun<registry_model, uint64_t, &registry_model::secondary_key>
         > > registry;

         void check_symbol_is_valid(const name& account, const symbol& sym);
   };
}