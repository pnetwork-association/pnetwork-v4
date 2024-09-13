#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include <eosio/singleton.hpp>

#include <string>

namespace eosio {
   using std::string;

   class [[eosio::contract("lockbox")]] lockbox : public contract {
      public:
         using contract::contract;

         [[eosio::action]]
         void init(const name& xerc20, const symbol& xerc20_symbol, const name& token, const symbol& token_symbol);

         [[eosio::action]]
         void deposit(const name& from, const name& to, const asset& quantity, const string& mem);

         // [[eosio::action]]
         // void deposit2(const name& user, const asset& amount);

         // [[eosio::action]]
         // void depositnat2(const name& user);

         // [[eosio::action]]
         // void withdraw(const asset& amount);

         // [[eosio::action]]
         // void withdraw2(const name& user, const asset& amount);

         // using init_action = eosio::action_wrapper<"init"_n, &token::init>;
      private:
         struct [[eosio::table]] registry_model {
            // NOTE: EVM XERC20Lockbox contract includes
            // a isNative boolean in the storage flagging
            // if the xerc20 wraps the native currency.
            // Here we don't need that since EOS is an
            // eosio.token.
            name     token;
            symbol   token_symbol;
            name     xerc20;
            symbol   xerc20_symbol;

            uint64_t primary_key() const { return token.value; }
            uint64_t secondary_key() const { return xerc20.value; }
         };

         // Needed to access the token/XERC20 symbols
         struct [[eosio::table]] currency_stats {
            asset    supply;
            asset    max_supply;
            name     issuer;

            uint64_t primary_key()const { return supply.symbol.code().raw(); }
         };
         typedef eosio::multi_index< "stat"_n, currency_stats > stats;

         typedef eosio::multi_index<"registry"_n, registry_model,
            indexed_by< "byxerctw"_n, const_mem_fun<registry_model, uint64_t, &registry_model::secondary_key>
         > > registry;

         void check_symbol_is_valid(const name& account, const symbol& sym);
   };
}