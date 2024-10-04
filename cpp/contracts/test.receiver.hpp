#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include <eosio/singleton.hpp>

#include <string>

#include "operation.hpp"
#include "metadata.hpp"

namespace eosio {
   using std::string;

   class [[eosio::contract("test.receiver")]] testreceiver : public contract {
      public:
         using contract::contract;

         [[eosio::on_notify("*::settle")]]
         void onreceive(const name& caller, const operation& operation, const metadata& metadata);

      private:

      struct [[eosio::table]] result_table {
         uint64_t id;
         bytes data;

         uint64_t primary_key() const { return id; }
      };

      typedef eosio::multi_index<"results"_n, result_table> results;
   };
}
