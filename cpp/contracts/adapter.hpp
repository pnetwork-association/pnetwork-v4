#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include <eosio/singleton.hpp>
#include <eosio/fixed_bytes.hpp>

#include <string>

#include "pam.hpp"
#include "metadata.hpp"
#include "operation.hpp"
#include "xerc20.token.hpp"

#include "tables/token_stats.table.hpp"
#include "tables/lockbox_registry.table.hpp"
#include "tables/adapter_registry.table.hpp"
#include "tables/adapter_past_events.table.hpp"

namespace eosio {
   using std::string;
   using std::vector;
   using std::make_tuple;
   using eosio::operation;
   using eosio::action_wrapper;
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
            const checksum256& token_bytes,
            const asset& min_fee
         );

         [[eosio::action]]
         void setfeemanagr(const name& fee_manager);

         [[eosio::action]]
         void adduserdata(const name& caller, bytes payload);

         [[eosio::action]]
         void freeuserdata(const name& account);

         [[eosio::action]]
         void swap(const uint64_t& nonce, const bytes& event_bytes);

         [[eosio::action]]
         void settle(const name& caller, const operation& operation, const metadata& metadata);

         [[eosio::on_notify("*::mint")]]
         void onmint(const name& caller, const name& to, const asset& quantity, const string& memo);

         [[eosio::on_notify("*::transfer")]]
         void ontransfer(const name& from, const name& to, const asset& quantity, const string& memo);

         asset calculate_fees(const asset& quantity);

         using action_swap = action_wrapper<"swap"_n, &adapter::swap>;
         using action_burn = action_wrapper<"burn"_n, &xtoken::burn>;
         using action_mint = action_wrapper<"mint"_n, &xtoken::mint>;
         using action_transfer = action_wrapper<"transfer"_n, &xtoken::transfer>;
      private:
         uint128_t FEE_BASIS_POINTS = 1750;
         uint128_t FEE_BASIS_POINTS_DIVISOR = 1000000; // 4 decimals for basis point + 2 decimals for percentage

         struct [[eosio::table]] global_storage_table {
            uint128_t   nonce;
            name        feesmanager;
         };

         // Scoped with user account
         struct [[eosio::table]] user_data_table {
            uint64_t id;
            bytes payload;

            uint64_t primary_key() const { return id; }
         };

         typedef eosio::multi_index<"stat"_n, token_stats_table> stats;
         typedef eosio::multi_index<"userdata"_n, user_data_table> user_data;
         typedef eosio::multi_index<"pastevents"_n, adapter_past_events_table, adapter_past_events_byeventid> past_events;
         typedef eosio::multi_index<"reglockbox"_n, lockbox_registry_table, lockbox_registry_byxtoken> registry_lockbox;
         typedef eosio::multi_index<
            "regadapter"_n,
            adapter_registry_table,
            adapter_registry_byxtoken,
            adapter_registry_bytokenbytes
         > registry_adapter;
         typedef eosio::multi_index<"mappings"_n, pam::mappings> mappings_table;

         using tee_pubkey = singleton<"tee"_n, pam::tee>;
         using lockbox_singleton = singleton<"lockbox"_n, name>;
         using storage = singleton<"storage"_n, global_storage_table>;

         global_storage_table empty_storage = {
            .nonce = 0,
            .feesmanager = ""_n
         };


         void check_symbol_is_valid(const name& account, const symbol& sym);
         void extract_memo_args(
            const name& self,
            const name& userdata_owner,
            const string& memo,
            string& out_sender,
            string& out_dest_chainid,
            string& out_recipient,
            bytes& out_dat
         );
         void token_transfer_from_lockbox(
            const name& self,
            const name& token,
            const asset& quantity,
            const string& memo
         );
         void token_transfer_from_user(
            const name& self,
            const name& token,
            const name& lockbox,
            const asset& quantity,
            const string& memo
         );
         void xerc20_transfer_from_any(
            const name& self,
            const name& caller,
            const name& token,
            const name& xerc20,
            const asset& quantity,
            const string& memo
         );
   };
}