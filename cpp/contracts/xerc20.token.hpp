#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include <eosio/singleton.hpp>

#include <string>

namespace eosio {
   using std::string;

   class [[eosio::contract("xerc20.token")]] xtoken : public contract {
      public:
         using contract::contract;

         [[eosio::action]]
         void create(const name& issuer, const asset& maximum_supply);

         [[eosio::action]]
         void mint(const name& caller, const name& to, const asset& quantity, const string& memo);

         [[eosio::action]]
         void burn(const name& caller, const asset& quantity, const string& memo);

         [[eosio::action]]
         void transfer(const name& from, const name& to, const asset& quantity, const string& memo);

         [[eosio::action]]
         void setlimits(const name& bridge, const asset& minting_limit, const asset& burning_limit);

         [[eosio::action]]
         void setlockbox(const name& account);

         [[eosio::action]]
         void open(const name& owner, const symbol& symbol, const name& ram_payer);

         [[eosio::action]]
         void close(const name& owner, const symbol& symbol);

         static asset get_supply(const name& token_contract_account, const symbol_code& sym_code) {
            stats statstable(token_contract_account, sym_code.raw());
            const auto& st = statstable.get(sym_code.raw(), "invalid supply symbol code");
            return st.supply;
         }

         static asset get_balance(const name& token_contract_account, const name& owner, const symbol_code& sym_code) {
            accounts accountstable(token_contract_account, owner.value);
            const auto& ac = accountstable.get(sym_code.raw(), "no balance with specified symbol");
            return ac.balance;
         }

         static asset minting_max_limit_of(const name& token_contract_account, const name& bridge, const symbol& sym) {
            bridges bridgestable(token_contract_account, token_contract_account.value);
            auto idx = bridgestable.get_index<name("bysymbol")>();
            auto itr = idx.lower_bound(sym.code().raw());
            while (itr != idx.end() && itr->account != bridge) { itr++; }

            check(itr != idx.end(), "entry not found");

            return itr->minting_max_limit;
         }

         static asset burning_max_limit_of(const name& token_contract_account, const name& bridge, const symbol& sym) {
            bridges bridgestable(token_contract_account, token_contract_account.value);
            auto idx = bridgestable.get_index<name("bysymbol")>();
            auto itr = idx.lower_bound(sym.code().raw());
            while (itr != idx.end() && itr->account != bridge) { itr++; }

            check(itr != idx.end(), "entry not found");

            return itr->burning_max_limit;
         }

      private:
         uint64_t const DURATION = 86400; // 1 days in seconds

         struct [[eosio::table]] account {
            asset    balance;

            uint64_t primary_key() const {
               return balance.symbol.code().raw();
            }
         };

         struct [[eosio::table]] currency_stats {
            asset    supply;
            asset    max_supply;
            name     issuer;

            uint64_t primary_key() const {
               return supply.symbol.code().raw();
            }
         };

         struct [[eosio::table]] bridge_model {
            name        account;
            uint64_t    minting_timestamp;
            float       minting_rate;
            asset       minting_current_limit;
            asset       minting_max_limit;
            uint64_t    burning_timestamp;
            float       burning_rate;
            asset       burning_current_limit;
            asset       burning_max_limit;

            // NOTE: we assume all the minting burning limits
            // symbols match here
            uint64_t primary_key() const {
               return account.value;
            }
            uint64_t secondary_key() const {
               return minting_current_limit.symbol.code().raw();
            }
         };

         typedef eosio::multi_index< "accounts"_n, account > accounts;
         typedef eosio::multi_index< "stat"_n, currency_stats > stats;
         typedef eosio::multi_index< "bridges"_n, bridge_model,
            indexed_by< "bysymbol"_n, const_mem_fun<bridge_model, uint64_t, &bridge_model::secondary_key>
         > > bridges;

         using lockbox_singleton = singleton<"lockbox"_n, name>;

         asset minting_current_limit_of(bridge_model& bridge);
         asset burning_current_limit_of(bridge_model& bridge);
         void use_minter_limits(bridge_model& bridge, const asset& change);
         void use_burner_limits(bridge_model& bridge, const asset& change);
         void change_minter_limit(bridge_model& bridge, const asset& limit);
         void change_burner_limit(bridge_model& bridge, const asset& limit);
         bridge_model get_empty_bridge_model(const name& account, const symbol& symbol);
         asset calculate_new_current_limit(const asset& limit, const asset& old_limit, const asset& current_limit);
         asset get_current_limit(const asset& current_limit, const asset& max_limit, const uint64_t timestamp, const uint64_t rate_per_second);
         void sub_balance(const name& owner, const asset& value);
         void add_balance(const name& owner, const asset& value, const name& ram_payer);
   };
}
