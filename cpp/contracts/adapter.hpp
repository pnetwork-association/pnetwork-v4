#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include <eosio/singleton.hpp>
#include <eosio/fixed_bytes.hpp>
#include <eosio/transaction.hpp>

#include <string>

#include "operation.hpp"
#include "metadata.hpp"

#include "tables/token_stats.table.hpp"
#include "tables/adapter_registry.table.hpp"
#include "tables/lockbox_registry.table.hpp"

namespace eosio {
   using std::string;
   using std::vector;
   using std::make_tuple;
   using eosio::operation;
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
            const symbol& token_symbol,
            const checksum256& token_bytes
         );

         [[eosio::action]]
         void setfeemanagr(const name& fee_manager);

         [[eosio::action]]
         void setpam(const name& pam);

         [[eosio::action]]
         void adduserdata(std::vector<uint8_t> user_data);

         [[eosio::action]]
         void swap(const uint64_t& nonce, const bytes& event_bytes);

         [[eosio::on_notify("*::transfer")]]
         void ontransfer(const name& from, const name& to, const asset& quantity, const string& memo);

         [[eosio::on_notify("*::mint")]]
         void onmint(const name& caller, const name& to, const asset& quantity, const string& memo);

         [[eosio::action]]
         void settle(const operation& operation, const metadata& metadata);

         // [[eosio::on_notify("*::transfer")]]
         // void ontransfer(const name& from, const name& to, const asset& quantity, const string& memo);
      private:
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

         typedef eosio::multi_index<"stat"_n, token_stats_table> stats;

         using byeventid = indexed_by<"byeventid"_n, const_mem_fun<past_events_model, checksum256, &past_events_model::secondary_key> >;
         typedef eosio::multi_index<"pastevents"_n, past_events_model, byeventid> past_events;
         typedef eosio::multi_index<"reglockbox"_n, lockbox_registry_table, lockbox_registry_byxtoken> registry_lockbox;
         typedef eosio::multi_index<
            "regadapter"_n,
            adapter_registry_table,
            adapter_registry_byxtoken,
            adapter_registry_bytokenbytes
         > registry_adapter;

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