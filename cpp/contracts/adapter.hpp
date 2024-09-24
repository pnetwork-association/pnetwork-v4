#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include <eosio/singleton.hpp>
#include <eosio/fixed_bytes.hpp>
#include <eosio/transaction.hpp>

#include <string>

namespace eosio {
   using std::string;
   using std::vector;
   using std::make_tuple;
   using eosio::read_transaction;
   using eosio::transaction_size;
   using eosio::unpack;
   using bytes = std::vector<uint8_t>;

   class [[eosio::contract("adapter")]] adapter : public contract {
      public:
         using contract::contract;

         [[eosio::action]]
         void create(
            const name& xerc20,
            const symbol& xerc20_symbol,
            const name& token,
            const symbol& token_symbol
         );

         [[eosio::action]]
         void setfeemanagr(const name& fee_manager);

         [[eosio::action]]
         void setpam(const name& pam);

         // [[eosio::action]]
         // void settle(const operation& operation_, const metadata& metadata_);

         [[eosio::action]]
         void adduserdata(std::vector<uint8_t> user_data);

         [[eosio::action]]
         void swap(const uint64_t& nonce, const bytes& event_bytes);

         [[eosio::on_notify("*::transfer")]]
         void ontransfer(const name& from, const name& to, const asset& quantity, const string& memo);

         [[eosio::on_notify("*::mint")]]
         void onmint(const name& caller, const name& to, const asset& quantity, const string& memo);

         // [[eosio::on_notify("*::transfer")]]
         // void ontransfer(const name& from, const name& to, const asset& quantity, const string& memo);

      private:
         struct [[eosio::table]] registry_model {
            // NOTE: see lockbox
            name     token;
            symbol   token_symbol;
            name     xerc20;
            symbol   xerc20_symbol;

            uint64_t primary_key()   const { return token_symbol.code().raw(); }
            uint64_t secondary_key() const { return xerc20_symbol.code().raw(); }
         };

         // Needed to access the token/XERC20 symbols table
         struct [[eosio::table]] currency_stats {
            asset    supply;
            asset    max_supply;
            name     issuer;

            uint64_t primary_key() const { return supply.symbol.code().raw(); }
         };

         struct [[eosio::table]] past_events_model {
            uint64_t      nonce;
            checksum256   event_id;

            uint64_t    primary_key()   const { return nonce; }
            checksum256 secondary_key() const { return event_id; }
         };

         struct [[eosio::table]] global_storage_model {
            name       pam;
            name       minfee;
            name       feesmanager;
         };

         typedef eosio::multi_index<"stat"_n, currency_stats> stats;
         typedef eosio::multi_index<"registry"_n, registry_model,
            indexed_by< "byxtoken"_n, const_mem_fun<registry_model, uint64_t, &registry_model::secondary_key>
         > > registry;
         typedef eosio::multi_index<"pastevents"_n, past_events_model,
            indexed_by< "byeventid"_n, const_mem_fun<past_events_model, checksum256, &past_events_model::secondary_key>
         > > past_events;

         using lockbox_singleton = singleton<"lockbox"_n, name>;
         using storage = singleton<"storage"_n, global_storage_model>;

         global_storage_model empty_storage = {
            .pam = ""_n,
            .feesmanager = ""_n,
            .minfee = ""_n
         };

         void check_symbol_is_valid(const name& account, const symbol& sym);
         void extract_memo_args(
            const name& self,
            const string& memo,
            string& out_sender,
            string& out_dest_chainid,
            string& out_recipient,
            bytes& out_dat
         );
   };
}